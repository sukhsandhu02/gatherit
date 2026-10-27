import fastifyCors from '@fastify/cors';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { hostRoutes } from './routes/host.js';
import { guestRoutes } from './routes/guest.js';
import { joinPageRoutes } from './routes/join-page.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'keepsake-default-secret-string-change-me-32chars';

// Ensure data/media directory exists
export const MEDIA_DIR = path.resolve(__dirname, '../data/media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Saved guest voice messages (WAV + JSON metadata sidecar)
export const VOICE_DIR = path.resolve(__dirname, '../data/voice');
if (!fs.existsSync(VOICE_DIR)) {
  fs.mkdirSync(VOICE_DIR, { recursive: true });
}

export const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  disableRequestLogging: false,
});

fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  if (!body || (typeof body === 'string' && body.trim().length === 0)) {
    done(null, {});
    return;
  }
  try {
    const json = JSON.parse(body as string);
    done(null, json);
  } catch (err: any) {
    done(err, undefined);
  }
});
await fastify.register(fastifyCors, {
  origin: ['https://gatherit.onrender.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});
// Register Plugins
await fastify.register(fastifyCookie, {
  secret: JWT_SECRET,
});

await fastify.register(fastifyJwt, {
  secret: JWT_SECRET,
  cookie: {
    cookieName: 'token',
    signed: false,
  },
});

await fastify.register(fastifyRateLimit, {
  global: false,
});

await fastify.register(fastifyWebsocket);

await fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

// Static client & media files
const WEB_DIST = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(WEB_DIST)) {
  await fastify.register(fastifyStatic, {
    root: WEB_DIST,
    prefix: '/',
    cacheControl: false,
    setHeaders: (res, pathName) => {
      if (pathName.includes('/assets/')) {
        res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('cache-control', 'no-cache');
      }
    },
  });
}

// Media files static serving
await fastify.register(fastifyStatic, {
  root: MEDIA_DIR,
  prefix: '/media-files/',
  decorateReply: false,
});

// Connected WebSocket clients
export const connectedGuests = new Map<string, Set<any>>(); // guestId -> Set<WebSocket>
export const connectedHosts = new Set<any>(); // Set<WebSocket>
export const meshSockets = new Map<string, any>(); // peerId -> WebSocket
export const allConnectedSockets = new Set<any>(); // all active WebSocket clients

// Connected device location telemetry (deviceId -> telemetry)
export interface DeviceLocationPayload {
  deviceId: string;
  name?: string;
  role: 'host' | 'guest';
  latitude: number;
  longitude: number;
  accuracy?: number;
  updatedAt: number;
  isOnline: boolean;
}
export const deviceLocations = new Map<string, DeviceLocationPayload>();

// Live Camera Sharing Configs (guestId -> config)
export interface GuestLiveShareConfig {
  guestId: string;
  guestName: string;
  shareMode: 'off' | 'host' | 'all' | 'selected';
  allowedGuestIds: Set<string>;
  lastFrameTime: number;
}
export const guestLiveShareConfigs = new Map<string, GuestLiveShareConfig>();

export function broadcastLiveStreamsUpdate() {
  const now = Date.now();
  const activeStreams: { guestId: string; guestName: string; shareMode: 'off' | 'host' | 'all' | 'selected'; allowedGuestIds: string[]; lastFrameTime: number }[] = [];
  for (const [, cfg] of guestLiveShareConfigs) {
    if (cfg.shareMode !== 'off' && now - cfg.lastFrameTime < 6000) {
      activeStreams.push({
        guestId: cfg.guestId,
        guestName: cfg.guestName,
        shareMode: cfg.shareMode,
        allowedGuestIds: Array.from(cfg.allowedGuestIds),
        lastFrameTime: cfg.lastFrameTime,
      });
    }
  }

  // Send tailored active stream list to each connected guest socket
  for (const [targetGuestId, sockets] of connectedGuests) {
    const streamsForTarget = activeStreams
      .filter((s) => s.guestId !== targetGuestId && (s.shareMode === 'all' || s.allowedGuestIds.includes(targetGuestId)))
      .map((s) => ({
        guestId: s.guestId,
        guestName: s.guestName,
        isSharedToAll: s.shareMode === 'all',
        lastFrameTime: s.lastFrameTime,
      }));

    const myCfg = guestLiveShareConfigs.get(targetGuestId);
    const payload = JSON.stringify({
      type: 'live_streams_sync',
      streams: streamsForTarget,
      myConfig: myCfg ? {
        shareMode: myCfg.shareMode,
        allowedGuestIds: Array.from(myCfg.allowedGuestIds),
      } : { shareMode: 'off', allowedGuestIds: [] },
    });

    for (const s of sockets) {
      if (s.readyState === 1) {
        s.send(payload);
      }
    }
  }
}

// Stale live streamers cleanup timer (removes disconnected or inactive streamers after 6 seconds)
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [guestId, cfg] of guestLiveShareConfigs) {
    if (cfg.shareMode !== 'off' && now - cfg.lastFrameTime > 6000) {
      guestLiveShareConfigs.delete(guestId);
      changed = true;
    }
  }
  if (changed) {
    broadcastLiveStreamsUpdate();
  }
}, 3000);

// Health check endpoint
fastify.get('/api/health', async (_req, reply) => {
  try {
    const result = await db.execute(sql`SELECT 1 as healthy`);
    return {
      status: 'ok',
      db: result.rows.length > 0 ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    fastify.log.error(err);
    reply.status(500);
    return { status: 'error', db: 'unreachable', error: err.message };
  }
});

// Register Routes
await fastify.register(hostRoutes);
await fastify.register(guestRoutes);
await fastify.register(joinPageRoutes);

// Guest-originated voice (guest -> host and/or selected guests). Never broadcast to everyone.
const GUEST_VOICE_MAX_TARGETS = 25;
const GUEST_VOICE_MAX_PCM_CHARS = 64 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GUEST_VOICE_MAX_RECORD_BYTES = 4 * 1024 * 1024;
const GUEST_VOICE_MIN_RECORD_MS = 300;

interface GuestVoiceSession {
  guestId: string;
  name: string;
  eventId: string;
  includeHost: boolean;
  targets: Set<string>;
  targetNames: string[];
  startedAt: number;
  sampleRate: number;
  chunks: Buffer[];
  bytes: number;
}

function buildWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Persist a finished guest voice message so the host can listen to it later
function saveGuestVoice(session: GuestVoiceSession) {
  const pcm = Buffer.concat(session.chunks);
  const durationMs = Math.round((pcm.length / 2 / session.sampleRate) * 1000);
  if (durationMs < GUEST_VOICE_MIN_RECORD_MS) return;
  const id = crypto.randomUUID();
  const meta = {
    id,
    eventId: session.eventId,
    fromGuestId: session.guestId,
    fromName: session.name,
    toHost: session.includeHost,
    toGuestNames: session.targetNames,
    startedAt: session.startedAt,
    durationMs,
  };
  fs.promises
    .writeFile(path.join(VOICE_DIR, `${id}.wav`), buildWav(pcm, session.sampleRate))
    .then(() => fs.promises.writeFile(path.join(VOICE_DIR, `${id}.json`), JSON.stringify(meta)))
    .catch((err) => fastify.log.error(err, 'Failed to save guest voice message'));
}

// A listener may hold several sockets (mesh + camera/live pages); only the mesh socket plays audio.
function pickListenerSockets(sockets: Iterable<any>): any[] {
  const open = Array.from(sockets).filter((s) => s.readyState === 1);
  const mesh = open.filter((s) => s.peerId);
  return mesh.length > 0 ? mesh : open;
}

function deliverGuestVoice(
  socket: any,
  type: 'pa_start' | 'pa_audio' | 'pa_stop',
  extra: { pcm?: string; sampleRate?: number; seq?: number } = {}
) {
  const session: GuestVoiceSession | undefined = socket.guestVoice;
  if (!session) return;
  if (type === 'pa_audio' && extra.pcm && session.bytes < GUEST_VOICE_MAX_RECORD_BYTES) {
    const buf = Buffer.from(extra.pcm, 'base64');
    if (session.chunks.length === 0 && extra.sampleRate) session.sampleRate = extra.sampleRate;
    session.chunks.push(buf);
    session.bytes += buf.length;
  }
  const base = {
    type,
    sender: session.name,
    alertTitle: 'Voice message',
    timestamp: Date.now(),
    fromGuestId: session.guestId,
    ...extra,
  };
  if (session.includeHost) {
    const payload = JSON.stringify({ ...base, targetGuestId: 'host', targetName: 'Host' });
    for (const hostSocket of pickListenerSockets(connectedHosts)) hostSocket.send(payload);
  }
  for (const targetId of session.targets) {
    const payload = JSON.stringify({ ...base, targetGuestId: targetId });
    for (const targetSocket of pickListenerSockets(connectedGuests.get(targetId) ?? [])) {
      if (targetSocket !== socket) targetSocket.send(payload);
    }
  }
}

function endGuestVoice(socket: any) {
  if (!socket.guestVoice) return;
  deliverGuestVoice(socket, 'pa_stop');
  saveGuestVoice(socket.guestVoice);
  socket.guestVoice = undefined;
}

async function handleGuestVoice(socket: any, guestId: string, parsed: any) {
  if (parsed.type === 'gpa_start') {
    endGuestVoice(socket);
    const requested: string[] = Array.isArray(parsed.targets) ? parsed.targets.map(String) : [];
    const includeHost = requested.includes('host');
    const guestTargets = Array.from(new Set(requested.filter((t) => t !== 'host' && t !== guestId && UUID_RE.test(t))))
      .slice(0, GUEST_VOICE_MAX_TARGETS);

    const [me] = await db
      .select({ name: schema.guests.name, eventId: schema.guests.eventId, status: schema.guests.status })
      .from(schema.guests)
      .where(eq(schema.guests.id, guestId))
      .limit(1);
    if (!me || me.status !== 'active') {
      socket.send(JSON.stringify({ type: 'gpa_error', error: 'Not allowed to send voice messages' }));
      return;
    }

    // Only allow recipients that are active guests of the same event
    const validTargets = guestTargets.length
      ? (await db
          .select({ id: schema.guests.id, name: schema.guests.name })
          .from(schema.guests)
          .where(and(eq(schema.guests.eventId, me.eventId), eq(schema.guests.status, 'active'), inArray(schema.guests.id, guestTargets)))
        )
      : [];

    if (!includeHost && validTargets.length === 0) {
      socket.send(JSON.stringify({ type: 'gpa_error', error: 'Pick at least one recipient' }));
      return;
    }

    socket.guestVoice = {
      guestId,
      name: me.name,
      eventId: me.eventId,
      includeHost,
      targets: new Set(validTargets.map((g) => g.id)),
      targetNames: validTargets.map((g) => g.name),
      startedAt: Date.now(),
      sampleRate: 16000,
      chunks: [],
      bytes: 0,
    } as GuestVoiceSession;
    deliverGuestVoice(socket, 'pa_start');
    return;
  }

  if (!socket.guestVoice) return;

  if (parsed.type === 'gpa_audio') {
    if (typeof parsed.pcm !== 'string' || parsed.pcm.length === 0 || parsed.pcm.length > GUEST_VOICE_MAX_PCM_CHARS) return;
    deliverGuestVoice(socket, 'pa_audio', {
      pcm: parsed.pcm,
      sampleRate: Number(parsed.sampleRate) || 16000,
      seq: typeof parsed.seq === 'number' ? parsed.seq : undefined,
    });
  } else if (parsed.type === 'gpa_stop') {
    endGuestVoice(socket);
  }
}

// WebSocket endpoint
fastify.get('/ws', { websocket: true }, (socket, req) => {
  fastify.log.info({ ip: req.ip }, 'WebSocket client connected');
  allConnectedSockets.add(socket);

  // Authenticate socket via cookies
  const cookies = req.headers.cookie
    ? Object.fromEntries(
        req.headers.cookie.split(';').map((c) => {
          const [k, ...v] = c.trim().split('=');
          return [k, decodeURIComponent(v.join('='))];
        })
      )
    : {};

  let authContext: { role: 'host' | 'guest'; guestId?: string } | null = null;

  // Check host token in cookies, query parameter, or authorization header
  let candidateHostToken: string | undefined = cookies.host_token;
  if (!candidateHostToken) {
    try {
      const url = new URL(req.url, 'http://localhost');
      candidateHostToken = url.searchParams.get('token') || undefined;
    } catch {}
  }
  if (!candidateHostToken && req.headers.authorization?.startsWith('Bearer ')) {
    candidateHostToken = req.headers.authorization.slice(7).trim();
  }

  if (candidateHostToken) {
    try {
      const decoded = fastify.jwt.verify<{ role: string; eventId?: string }>(candidateHostToken);
      if (decoded.role === 'host') {
        authContext = { role: 'host' };
        connectedHosts.add(socket);
      }
    } catch {
      // not a host token
    }
  }

  // Check guest token in cookies, query parameters, or authorization header
  let guestToken: string | undefined = cookies.guest_token;
  if (!guestToken) {
    try {
      const url = new URL(req.url, 'http://localhost');
      guestToken = url.searchParams.get('token') || undefined;
    } catch {}
  }
  if (!guestToken && req.headers.authorization?.startsWith('Bearer ')) {
    guestToken = req.headers.authorization.slice(7).trim();
  }

  if (!authContext && guestToken) {
    try {
      const decoded = fastify.jwt.verify<{ guestId: string; role: string }>(guestToken);
      if (decoded.guestId) {
        authContext = { role: 'guest', guestId: decoded.guestId };
        (socket as any).guestId = decoded.guestId;
        if (!connectedGuests.has(decoded.guestId)) {
          connectedGuests.set(decoded.guestId, new Set());
        }
        connectedGuests.get(decoded.guestId)!.add(socket);
      }
    } catch {
      // invalid guest token
    }
  }

  socket.on('message', (message: any, isBinary: boolean) => {
    // Binary preview frame from guest camera: forward to connected host sockets and authorized guests
    if (isBinary && authContext?.role === 'guest' && authContext.guestId) {
      const guestIdBuffer = Buffer.from(authContext.guestId.replace(/-/g, ''), 'hex');
      const payload = Buffer.concat([guestIdBuffer, Buffer.isBuffer(message) ? message : Buffer.from(message)]);

      // 1. Forward to connected host consoles
      for (const hostSocket of connectedHosts) {
        if (hostSocket.readyState === 1) {
          hostSocket.send(payload, { binary: true });
        }
      }

      // 2. Forward to other authorized guest sockets who are actively watching live
      const shareCfg = guestLiveShareConfigs.get(authContext.guestId);
      if (shareCfg && shareCfg.shareMode !== 'off') {
        shareCfg.lastFrameTime = Date.now();
        if (shareCfg.shareMode === 'all') {
          for (const [targetGuestId, sockets] of connectedGuests) {
            if (targetGuestId === authContext.guestId) continue;
            for (const targetSocket of sockets) {
              if (targetSocket.readyState === 1 && (targetSocket as any).watchingLive) {
                targetSocket.send(payload, { binary: true });
              }
            }
          }
        } else if (shareCfg.shareMode === 'selected') {
          for (const allowedGuestId of shareCfg.allowedGuestIds) {
            if (allowedGuestId === authContext.guestId) continue;
            const sockets = connectedGuests.get(allowedGuestId);
            if (sockets) {
              for (const targetSocket of sockets) {
                if (targetSocket.readyState === 1 && (targetSocket as any).watchingLive) {
                  targetSocket.send(payload, { binary: true });
                }
              }
            }
          }
        }
      }
      return;
    }

    try {
      const text = message.toString();
      const parsed = JSON.parse(text);

      if (parsed.type === 'watch_live_start') {
        (socket as any).watchingLive = true;
        const now = Date.now();
        const myGuestId = authContext?.role === 'guest' ? authContext.guestId : ((socket as any).guestId || null);
        const availableStreams = Array.from(guestLiveShareConfigs.values())
          .filter((s) => s.shareMode !== 'off' && now - s.lastFrameTime < 6000 && (!myGuestId || s.guestId !== myGuestId) && (!myGuestId || s.shareMode === 'all' || s.allowedGuestIds.has(myGuestId)))
          .map((s) => ({
            guestId: s.guestId,
            guestName: s.guestName,
            isSharedToAll: s.shareMode === 'all',
            lastFrameTime: s.lastFrameTime,
          }));

        const myCfg = myGuestId ? guestLiveShareConfigs.get(myGuestId) : null;
        socket.send(JSON.stringify({
          type: 'live_streams_sync',
          streams: availableStreams,
          myConfig: myCfg ? {
            shareMode: myCfg.shareMode,
            allowedGuestIds: Array.from(myCfg.allowedGuestIds),
          } : { shareMode: 'off', allowedGuestIds: [] },
        }));
        return;
      }

      if (parsed.type === 'watch_live_stop') {
        (socket as any).watchingLive = false;
        return;
      }

      if (parsed.type === 'live_share_config') {
        const guestId = (authContext?.role === 'guest' ? authContext.guestId : null) || (socket as any).guestId || parsed.guestId;
        if (guestId) {
          const { shareMode, allowedGuestIds, guestName } = parsed;
          if (shareMode === 'off' || shareMode === 'host') {
            guestLiveShareConfigs.delete(guestId);
          } else {
            const existing = guestLiveShareConfigs.get(guestId);
            guestLiveShareConfigs.set(guestId, {
              guestId,
              guestName: guestName || existing?.guestName || 'Guest',
              shareMode: shareMode === 'selected' ? 'selected' : 'all',
              allowedGuestIds: new Set(Array.isArray(allowedGuestIds) ? allowedGuestIds : []),
              lastFrameTime: Date.now(),
            });
          }
          broadcastLiveStreamsUpdate();
        }
        return;
      }

      if (parsed.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      // Host camera boost control
      if (authContext?.role === 'host' && (parsed.type === 'boost' || parsed.type === 'unboost')) {
        const guestSockets = connectedGuests.get(parsed.guestId);
        if (guestSockets) {
          for (const s of guestSockets) {
            if (s.readyState === 1) {
              s.send(JSON.stringify(parsed));
            }
          }
        }
        return;
      }

      // Host Emergency Walkie-Talkie / PA Broadcast Relay
      if (parsed.type === 'pa_start' || parsed.type === 'pa_audio' || parsed.type === 'pa_stop') {
        let isAuthorizedHost = authContext?.role === 'host' || connectedHosts.has(socket);
        if (!isAuthorizedHost && parsed.hostToken) {
          try {
            const decoded = fastify.jwt.verify<{ role: string }>(parsed.hostToken);
            if (decoded.role === 'host') {
              isAuthorizedHost = true;
              authContext = { role: 'host' };
              connectedHosts.add(socket);
            }
          } catch {}
        }
        if (!isAuthorizedHost && (req.headers.cookie?.includes('host_token') || req.headers.referer?.includes('/host'))) {
          isAuthorizedHost = true;
          authContext = { role: 'host' };
          connectedHosts.add(socket);
        }

        if (isAuthorizedHost) {
          const targetGuestId = (parsed.targetGuestId && parsed.targetGuestId !== 'all') ? String(parsed.targetGuestId) : null;
          const broadcastPayload = JSON.stringify({
            type: parsed.type,
            sender: parsed.sender || 'Host Console',
            timestamp: parsed.timestamp || Date.now(),
            alertTitle: parsed.alertTitle,
            targetGuestId: targetGuestId,
            targetName: parsed.targetName || null,
            pcm: parsed.pcm,
            sampleRate: parsed.sampleRate || 16000,
            seq: parsed.seq,
          });

          if (targetGuestId) {
            // Targeted dispatch: only deliver to specified guest or device
            let sentCount = 0;
            const guestSockets = connectedGuests.get(targetGuestId);
            if (guestSockets) {
              for (const targetSocket of guestSockets) {
                if (targetSocket !== socket && targetSocket.readyState === 1) {
                  targetSocket.send(broadcastPayload);
                  sentCount++;
                }
              }
            }
            const meshSocket = meshSockets.get(targetGuestId);
            if (meshSocket && meshSocket !== socket && meshSocket.readyState === 1) {
              meshSocket.send(broadcastPayload);
              sentCount++;
            }
            if (sentCount === 0) {
              for (const clientSocket of allConnectedSockets) {
                if (
                  clientSocket !== socket &&
                  clientSocket.readyState === 1 &&
                  ((clientSocket as any).guestId === targetGuestId ||
                   (clientSocket as any).deviceId === targetGuestId ||
                   (clientSocket as any).peerId === targetGuestId)
                ) {
                  clientSocket.send(broadcastPayload);
                  sentCount++;
                }
              }
            }

            if (parsed.type === 'pa_start') {
              fastify.log.info({ targetGuestId, targetName: parsed.targetName, sentCount }, '🎯 Direct Host Walkie-Talkie STARTED to specific person');
            } else if (parsed.type === 'pa_stop') {
              fastify.log.info({ targetGuestId, targetName: parsed.targetName, sentCount }, '🎯 Direct Host Walkie-Talkie STOPPED to specific person');
            }
          } else {
            // Global Broadcast to ALL connected client devices (deduplicated per device)
            const deliveredGuests = new Set<string>();
            const deliveredPeers = new Set<string>();
            const deliveredRawSockets = new Set<any>();

            // Guests may hold several sockets (mesh + camera/live pages). Only the mesh socket plays PA audio,
            // so skip a guest's non-mesh sockets whenever that guest also has a mesh socket open.
            const guestIdsWithMesh = new Set<string>();
            for (const s of allConnectedSockets) {
              if (s.readyState === 1 && (s as any).guestId && (s as any).peerId) {
                guestIdsWithMesh.add((s as any).guestId);
              }
            }

            for (const clientSocket of allConnectedSockets) {
              if (clientSocket === socket || clientSocket.readyState !== 1) continue;
              // Never echo live host PA audio back to any host console socket
              if (connectedHosts.has(clientSocket)) continue;

              const gId = (clientSocket as any).guestId;
              if (gId && !(clientSocket as any).peerId && guestIdsWithMesh.has(gId)) continue;
              const pId = (clientSocket as any).peerId || (clientSocket as any).deviceId;

              if (gId) {
                if (deliveredGuests.has(gId)) continue;
                deliveredGuests.add(gId);
              } else if (pId) {
                if (deliveredPeers.has(pId)) continue;
                deliveredPeers.add(pId);
              } else {
                if (deliveredRawSockets.has(clientSocket)) continue;
                deliveredRawSockets.add(clientSocket);
              }

              clientSocket.send(broadcastPayload);
            }

            if (parsed.type === 'pa_start') {
              fastify.log.info({ ip: req.ip }, '📢 Emergency PA Broadcast STARTED by Host');
            } else if (parsed.type === 'pa_stop') {
              fastify.log.info({ ip: req.ip }, '📢 Emergency PA Broadcast STOPPED by Host');
            }
          }
        } else {
          socket.send(JSON.stringify({ type: 'error', error: 'Unauthorized: only hosts can broadcast on the emergency PA channel' }));
        }
        return;
      }

      // Guest voice message relay (guest -> host / selected guests)
      if (parsed.type === 'gpa_start' || parsed.type === 'gpa_audio' || parsed.type === 'gpa_stop') {
        if (authContext?.role !== 'guest' || !authContext.guestId) {
          socket.send(JSON.stringify({ type: 'gpa_error', error: 'Only logged-in guests can send voice messages' }));
          return;
        }
        handleGuestVoice(socket, authContext.guestId, parsed).catch((err) => fastify.log.error(err));
        return;
      }

      if (parsed.type === 'pa_status') {
        const uniqueGuestIds = new Set<string>();
        const anonymousDeviceIds = new Set<string>();

        for (const clientSocket of allConnectedSockets) {
          if (clientSocket.readyState !== 1) continue;
          if (connectedHosts.has(clientSocket)) continue;

          const gId = (clientSocket as any).guestId;
          const devId = (clientSocket as any).deviceId || (clientSocket as any).peerId;

          if (gId) {
            uniqueGuestIds.add(gId);
          } else if (devId) {
            anonymousDeviceIds.add(devId);
          } else {
            anonymousDeviceIds.add((clientSocket as any).id || (clientSocket as any)._socket?.remotePort || 'client');
          }
        }

        const realListenerCount = uniqueGuestIds.size + anonymousDeviceIds.size;
        socket.send(JSON.stringify({
          type: 'pa_status',
          connectedListeners: realListenerCount,
          onlineGuestIds: Array.from(uniqueGuestIds),
        }));
        return;
      }

      // P2P WebRTC Mesh Signaling Relay: Automatic zero-config handshake
      if (parsed.type === 'join_mesh') {
        const myPeerId = parsed.peerId;
        (socket as any).peerId = myPeerId;
        if (parsed.guestId) {
          (socket as any).guestId = parsed.guestId;
          if (!connectedGuests.has(parsed.guestId)) {
            connectedGuests.set(parsed.guestId, new Set());
          }
          connectedGuests.get(parsed.guestId)!.add(socket);
        }
        meshSockets.set(myPeerId, socket);

        // 1. Tell all existing peers about this new peer
        for (const [peerId, peerSocket] of meshSockets) {
          if (peerId !== myPeerId && peerSocket.readyState === 1) {
            peerSocket.send(JSON.stringify({ type: 'peer_joined', peerId: myPeerId }));
          }
        }

        // 2. Tell the new peer about all already connected peers so it connects instantly
        const existingPeers: string[] = [];
        for (const [peerId, peerSocket] of meshSockets) {
          if (peerId !== myPeerId && peerSocket.readyState === 1) {
            existingPeers.push(peerId);
          }
        }
        socket.send(JSON.stringify({ type: 'mesh_peers', peers: existingPeers }));
        return;
      }

      if (parsed.type === 'signal') {
        const targetId = parsed.target;
        const targetSocket = meshSockets.get(targetId);
        if (targetSocket && targetSocket.readyState === 1) {
          targetSocket.send(JSON.stringify({
            type: 'signal',
            source: (socket as any).peerId,
            signal: parsed.signal
          }));
        }
        return;
      }

      // Device Location Telemetry update
      if (parsed.type === 'location_update') {
        const id = parsed.deviceId || authContext?.guestId || (socket as any).peerId || 'anon-' + socket.id;
        (socket as any).deviceId = id;
        const record: DeviceLocationPayload = {
          deviceId: id,
          name: parsed.name || (authContext?.role === 'host' ? 'Host Console' : `Guest ${id.slice(0, 5)}`),
          role: authContext?.role || parsed.role || 'guest',
          latitude: Number(parsed.latitude),
          longitude: Number(parsed.longitude),
          accuracy: parsed.accuracy ? Number(parsed.accuracy) : undefined,
          updatedAt: Date.now(),
          isOnline: true,
        };
        deviceLocations.set(id, record);

        // Broadcast updated locations list to all connected clients immediately
        const payloadStr = JSON.stringify({
          type: 'device_locations',
          devices: Array.from(deviceLocations.values()),
        });

        for (const clientSocket of allConnectedSockets) {
          if (clientSocket.readyState === 1) {
            clientSocket.send(payloadStr);
          }
        }
        return;
      }

      if (parsed.type === 'delete_device') {
        if (parsed.deviceId && deviceLocations.has(parsed.deviceId)) {
          deviceLocations.delete(parsed.deviceId);
          const payloadStr = JSON.stringify({
            type: 'device_locations',
            devices: Array.from(deviceLocations.values()),
          });
          for (const hostSocket of connectedHosts) {
            if (hostSocket.readyState === 1) hostSocket.send(payloadStr);
          }
          for (const [, meshSocket] of meshSockets) {
            if (meshSocket.readyState === 1) meshSocket.send(payloadStr);
          }
        }
        return;
      }

      if (parsed.type === 'get_locations') {
        socket.send(JSON.stringify({
          type: 'device_locations',
          devices: Array.from(deviceLocations.values()),
        }));
        return;
      }

      socket.send(JSON.stringify({ type: 'echo', data: parsed }));
    } catch {
      socket.send(JSON.stringify({ type: 'echo', text: message.toString() }));
    }
  });

  socket.on('close', () => {
    if ((socket as any).peerId) {
      meshSockets.delete((socket as any).peerId);
    }
    if (authContext?.role === 'host') {
      connectedHosts.delete(socket);
    } else if (authContext?.role === 'guest' && authContext.guestId) {
      const sockets = connectedGuests.get(authContext.guestId);
      if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
          connectedGuests.delete(authContext.guestId);
          if (guestLiveShareConfigs.has(authContext.guestId)) {
            guestLiveShareConfigs.delete(authContext.guestId);
            broadcastLiveStreamsUpdate();
          }
        }
      }
    }

    endGuestVoice(socket);
    allConnectedSockets.delete(socket);

    if ((socket as any).deviceId && deviceLocations.has((socket as any).deviceId)) {
      deviceLocations.delete((socket as any).deviceId);
      const payloadStr = JSON.stringify({
        type: 'device_locations',
        devices: Array.from(deviceLocations.values()),
      });
      for (const clientSocket of allConnectedSockets) {
        if (clientSocket.readyState === 1) clientSocket.send(payloadStr);
      }
    }
  });
});

// SPA fallback for non-API routes
fastify.setNotFoundHandler(async (req, reply) => {
  if (req.url.startsWith('/api/') || req.url === '/ws') {
    return reply.status(404).send({ error: 'Endpoint not found' });
  }

  const indexPath = path.join(WEB_DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    return reply.type('text/html').send(fs.createReadStream(indexPath));
  }

  return reply.status(200).send(`<!DOCTYPE html>
<html>
  <head>
    <title>Gather</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { font-family: sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .card { text-align: center; padding: 2rem; border-radius: 1rem; background: #1e293b; border: 1px solid #334155; }
      h1 { color: #f59e0b; margin-bottom: 0.5rem; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Gather</h1>
      <p>Server running. Loading app...</p>
    </div>
  </body>
</html>`);
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
