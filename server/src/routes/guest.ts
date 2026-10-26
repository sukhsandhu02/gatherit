import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { normalizePhone } from '../utils/phone.js';
import { requireGuest } from '../middleware/auth.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import archiver from 'archiver';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MEDIA_DIR, connectedHosts, connectedGuests, guestLiveShareConfigs, broadcastLiveStreamsUpdate } from '../index.js';
import { retainEventMemory } from '../services/hindsight.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function guestRoutes(fastify: FastifyInstance) {
  // Public: Get Event Public Info by Slug
  fastify.get<{ Params: { slug: string } }>('/api/events/:slug', async (req, reply) => {
    const { slug } = req.params;
    const [eventRow] = await db
      .select({
        id: schema.event.id,
        name: schema.event.name,
        date: schema.event.date,
        slug: schema.event.slug,
        joinOpen: schema.event.joinOpen,
        requireApproval: schema.event.requireApproval,
      })
      .from(schema.event)
      .where(eq(schema.event.slug, slug))
      .limit(1);

    if (!eventRow) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    return { event: eventRow };
  });

  // Public: Get Shared Album/Collection by Slug
  fastify.get<{ Params: { shareSlug: string }; Querystring: { pw?: string } }>(
    '/api/guest-shares/:shareSlug',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (req, reply) => {
      const { shareSlug } = req.params;
      const { pw } = req.query;

      const [shareRow] = await db
        .select()
        .from(schema.guestShares)
        .where(eq(schema.guestShares.slug, shareSlug))
        .limit(1);

      if (!shareRow) {
        return reply.status(404).send({ error: 'Share link not found' });
      }

      if (shareRow.expiresAt && new Date(shareRow.expiresAt) < new Date()) {
        return reply.status(410).send({ error: 'This share link has expired' });
      }

      const hasPassword = !!shareRow.passwordHash;
      if (hasPassword) {
        if (!pw) {
          return reply.send({
            requiresPassword: true,
            title: shareRow.title || 'Shared Memories',
            slug: shareRow.slug,
          });
        }
        const isValid = await verifyPassword(pw, shareRow.passwordHash!);
        if (!isValid) {
          return reply.status(401).send({ error: 'Incorrect password', requiresPassword: true });
        }
      }

      // Fetch guest author info and event info
      const [author] = await db
        .select({ name: schema.guests.name })
        .from(schema.guests)
        .where(eq(schema.guests.id, shareRow.guestId))
        .limit(1);

      const [evt] = await db
        .select({ name: schema.event.name, slug: schema.event.slug })
        .from(schema.event)
        .where(eq(schema.event.id, shareRow.eventId))
        .limit(1);

      let mediaItems: any[] = [];
      if (shareRow.isAllMyUploads) {
        mediaItems = await db
          .select({
            id: schema.media.id,
            kind: schema.media.kind,
            path: schema.media.path,
            thumbPath: schema.media.thumbPath,
            sizeBytes: schema.media.sizeBytes,
            createdAt: schema.media.createdAt,
          })
          .from(schema.media)
          .where(and(eq(schema.media.eventId, shareRow.eventId), eq(schema.media.guestId, shareRow.guestId)))
          .orderBy(desc(schema.media.createdAt));
      } else {
        const itemRows = await db
          .select({ mediaId: schema.guestShareItems.mediaId })
          .from(schema.guestShareItems)
          .where(eq(schema.guestShareItems.shareId, shareRow.id));

        const mediaIds = itemRows.map((r) => r.mediaId);
        if (mediaIds.length > 0) {
          mediaItems = await db
            .select({
              id: schema.media.id,
              kind: schema.media.kind,
              path: schema.media.path,
              thumbPath: schema.media.thumbPath,
              sizeBytes: schema.media.sizeBytes,
              createdAt: schema.media.createdAt,
            })
            .from(schema.media)
            .where(and(eq(schema.media.eventId, shareRow.eventId), inArray(schema.media.id, mediaIds)))
            .orderBy(desc(schema.media.createdAt));
        }
      }

      return {
        share: {
          id: shareRow.id,
          slug: shareRow.slug,
          title: shareRow.title || `${author?.name || 'Guest'}'s Shared Memories`,
          authorName: author?.name || 'Guest',
          eventName: evt?.name || 'Event',
          eventSlug: evt?.slug || '',
          expiresAt: shareRow.expiresAt,
          hasPassword,
          createdAt: shareRow.createdAt,
        },
        media: mediaItems,
      };
    }
  );

  // Public: Stream or Download media from a Guest Share
  fastify.get<{
    Params: { shareSlug: string; mediaId: string };
    Querystring: { pw?: string; download?: string; thumb?: string };
  }>(
    '/api/guest-shares/:shareSlug/media/:mediaId',
    {
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute',
        },
      },
    },
    async (req, reply) => {
      const { shareSlug, mediaId } = req.params;
      const { pw, download, thumb } = req.query;
      const isDownload = download === '1' || download === 'true';
      const isThumb = thumb === '1' || thumb === 'true';

      const [shareRow] = await db
        .select()
        .from(schema.guestShares)
        .where(eq(schema.guestShares.slug, shareSlug))
        .limit(1);

      if (!shareRow) {
        return reply.status(404).send({ error: 'Share link not found' });
      }

      if (shareRow.expiresAt && new Date(shareRow.expiresAt) < new Date()) {
        return reply.status(410).send({ error: 'This share link has expired' });
      }

      if (shareRow.passwordHash) {
        if (!pw) return reply.status(401).send({ error: 'Password required' });
        const isValid = await verifyPassword(pw, shareRow.passwordHash);
        if (!isValid) return reply.status(401).send({ error: 'Incorrect password' });
      }

      // Verify media is part of this share
      let isAllowed = false;
      if (shareRow.isAllMyUploads) {
        const [m] = await db
          .select({ id: schema.media.id })
          .from(schema.media)
          .where(
            and(
              eq(schema.media.id, mediaId),
              eq(schema.media.eventId, shareRow.eventId),
              eq(schema.media.guestId, shareRow.guestId)
            )
          )
          .limit(1);
        if (m) isAllowed = true;
      } else {
        const [link] = await db
          .select()
          .from(schema.guestShareItems)
          .where(and(eq(schema.guestShareItems.shareId, shareRow.id), eq(schema.guestShareItems.mediaId, mediaId)))
          .limit(1);
        if (link) isAllowed = true;
      }

      if (!isAllowed) {
        return reply.status(404).send({ error: 'Media not found in this share' });
      }

      const [mediaItem] = await db
        .select()
        .from(schema.media)
        .where(eq(schema.media.id, mediaId))
        .limit(1);

      if (!mediaItem) {
        return reply.status(404).send({ error: 'Media not found' });
      }

      const relPath = isThumb
        ? (mediaItem.thumbPath || mediaItem.path).replace(/^\/media-files\//, '')
        : mediaItem.path.replace(/^\/media-files\//, '');
      const filePath = path.resolve(MEDIA_DIR, relPath);

      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: 'File on disk not found' });
      }

      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (mediaItem.kind === 'photo' || isThumb) {
        contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      } else {
        if (ext === '.webm') contentType = 'video/webm';
        else if (ext === '.mov') contentType = 'video/quicktime';
        else if (ext === '.ogv') contentType = 'video/ogg';
        else contentType = 'video/mp4';
      }

      if (isDownload) {
        const downloadName = `share-${mediaItem.id}${ext}`;
        reply.header('Content-Disposition', `attachment; filename="${downloadName}"`);
      }

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = end - start + 1;

        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Length', chunksize);
        reply.header('Content-Type', contentType);
        return reply.send(fs.createReadStream(filePath, { start, end }));
      }

      reply.header('Content-Type', contentType);
      reply.header('Content-Length', stats.size);
      reply.header('Accept-Ranges', 'bytes');
      return reply.send(fs.createReadStream(filePath));
    }
  );

  // Public: Download whole Guest Share collection as ZIP
  fastify.get<{ Params: { shareSlug: string }; Querystring: { pw?: string } }>(
    '/api/guest-shares/:shareSlug/zip',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (req, reply) => {
      const { shareSlug } = req.params;
      const { pw } = req.query;

      const [shareRow] = await db
        .select()
        .from(schema.guestShares)
        .where(eq(schema.guestShares.slug, shareSlug))
        .limit(1);

      if (!shareRow) {
        return reply.status(404).send({ error: 'Share link not found' });
      }

      if (shareRow.expiresAt && new Date(shareRow.expiresAt) < new Date()) {
        return reply.status(410).send({ error: 'This share link has expired' });
      }

      if (shareRow.passwordHash) {
        if (!pw) return reply.status(401).send({ error: 'Password required' });
        const isValid = await verifyPassword(pw, shareRow.passwordHash);
        if (!isValid) return reply.status(401).send({ error: 'Incorrect password' });
      }

      let mediaItems: any[] = [];
      if (shareRow.isAllMyUploads) {
        mediaItems = await db
          .select()
          .from(schema.media)
          .where(and(eq(schema.media.eventId, shareRow.eventId), eq(schema.media.guestId, shareRow.guestId)));
      } else {
        const itemRows = await db
          .select({ mediaId: schema.guestShareItems.mediaId })
          .from(schema.guestShareItems)
          .where(eq(schema.guestShareItems.shareId, shareRow.id));
        const mediaIds = itemRows.map((r) => r.mediaId);
        if (mediaIds.length > 0) {
          mediaItems = await db
            .select()
            .from(schema.media)
            .where(and(eq(schema.media.eventId, shareRow.eventId), inArray(schema.media.id, mediaIds)));
        }
      }

      if (mediaItems.length === 0) {
        return reply.status(404).send({ error: 'No media items in this share' });
      }

      const existingFiles: { fullPath: string; fileName: string }[] = [];
      const usedNames = new Set<string>();
      for (const m of mediaItems) {
        const relClean = m.path.replace(/^\/media-files\//, '');
        const fullPath = path.resolve(MEDIA_DIR, relClean);
        if (fs.existsSync(fullPath)) {
          let fileName = path.basename(fullPath);
          if (usedNames.has(fileName)) {
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            fileName = `${base}_${existingFiles.length + 1}${ext}`;
          }
          usedNames.add(fileName);
          existingFiles.push({ fullPath, fileName });
        }
      }

      if (existingFiles.length === 0) {
        return reply.status(404).send({ error: 'No files available on disk' });
      }

      const archive = archiver('zip', { zlib: { level: 5 } });
      const zipName = `share-${shareRow.slug}.zip`;
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${zipName}"`);

      for (const file of existingFiles) {
        archive.file(file.fullPath, { name: file.fileName });
      }

      archive.finalize();
      return reply.send(archive);
    }
  );
  fastify.post<{
    Params: { slug: string };
    Body: { name: string; phone: string; password: string };
  }>(
    '/api/events/:slug/join',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (req, reply) => {
      const { slug } = req.params;
      const { name, phone: rawPhone, password } = req.body || {};

      const [eventRow] = await db
        .select()
        .from(schema.event)
        .where(eq(schema.event.slug, slug))
        .limit(1);

      if (!eventRow) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const missing: string[] = [];
      const joinNameRequired = eventRow.joinPageNameRequired !== false;
      const joinPhoneRequired = eventRow.joinPagePhoneRequired !== false;
      const joinPasswordRequired = eventRow.joinPagePasswordRequired !== false;

      if (joinNameRequired && !name.trim()) missing.push('name');
      if (joinPhoneRequired && !rawPhone.trim()) missing.push('phone');
      if (joinPasswordRequired && (!password || password.length < 6)) missing.push('password');

      if (missing.length > 0) {
        return reply.status(400).send({
          error: `Please complete: ${missing.join(', ')}`,
          missing,
        });
      }

      const phone = normalizePhone(rawPhone);
      if (joinPhoneRequired && (!phone || phone.length < 10)) {
        return reply.status(400).send({ error: 'Please enter a valid phone number' });
      }

      if (eventRow.joinOpen === false) {
        return reply.status(403).send({ error: 'Joining is currently closed for this event.' });
      }

      // Check if phone already registered
      const [existingGuest] = await db
        .select()
        .from(schema.guests)
        .where(and(eq(schema.guests.eventId, eventRow.id), eq(schema.guests.phone, phone)))
        .limit(1);

      if (existingGuest) {
        return reply.status(409).send({
          error: 'This phone number has already joined. Please log in with your password.',
          alreadyJoined: true,
        });
      }

      // Guest cap check (e.g. 300)
      const allGuests = await db
        .select()
        .from(schema.guests)
        .where(eq(schema.guests.eventId, eventRow.id));

      if (allGuests.length >= 300) {
        return reply.status(403).send({ error: 'Guest capacity reached for this event.' });
      }

      const passwordHash = await hashPassword(password);
      const initialStatus = eventRow.requireApproval ? 'pending' : 'active';

      const [newGuest] = await db
        .insert(schema.guests)
        .values({
          eventId: eventRow.id,
          name: name.trim(),
          phone,
          passwordHash,
          status: initialStatus,
          canDownload: true,
          mustChangePassword: false,
          lastSeenAt: new Date(),
        })
        .returning();

      // Set guest session cookie
      const token = fastify.jwt.sign({
        role: 'guest',
        guestId: newGuest.id,
        eventId: eventRow.id,
      });

      reply.setCookie('guest_token', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: req.protocol === 'https',
      });

      // Fire-and-forget: retain join memory (does not affect response)
      retainEventMemory(
        eventRow.id,
        `Guest ${newGuest.name} joined the event at ${new Date().toISOString()}`,
      ).catch(() => {/* swallowed — hindsight.ts already logs */});

      return {
        success: true,
        token,
        guest: {
          id: newGuest.id,
          name: newGuest.name,
          phone: newGuest.phone,
          status: newGuest.status,
          canDownload: newGuest.canDownload,
        },
      };
    }
  );

  // Public: Guest Login (Rate-limited: 5 attempts/min per IP)
  fastify.post<{
    Params: { slug: string };
    Body: { phone: string; password: string };
  }>(
    '/api/events/:slug/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (req, reply) => {
      const { slug } = req.params;
      const { phone: rawPhone, password } = req.body || {};

      if (!rawPhone || !password) {
        return reply.status(400).send({ error: 'Phone number and password required' });
      }

      const [eventRow] = await db
        .select()
        .from(schema.event)
        .where(eq(schema.event.slug, slug))
        .limit(1);

      if (!eventRow) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const phone = normalizePhone(rawPhone);

      if (eventRow.joinPagePasswordRequired !== false && password.length < 6) {
        return reply.status(400).send({ error: 'Password must be at least 6 characters' });
      }

      const [guestRow] = await db
        .select()
        .from(schema.guests)
        .where(and(eq(schema.guests.eventId, eventRow.id), eq(schema.guests.phone, phone)))
        .limit(1);

      if (!guestRow) {
        return reply.status(401).send({ error: 'No account found with this phone number. Please join first.' });
      }

      const isValid = await verifyPassword(password, guestRow.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ error: 'Incorrect password' });
      }

      // Update last seen
      await db
        .update(schema.guests)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.guests.id, guestRow.id));

      const token = fastify.jwt.sign({
        role: 'guest',
        guestId: guestRow.id,
        eventId: eventRow.id,
      });

      reply.setCookie('guest_token', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: req.protocol === 'https',
      });

      return {
        success: true,
        token,
        guest: {
          id: guestRow.id,
          name: guestRow.name,
          phone: guestRow.phone,
          status: guestRow.status,
          canDownload: guestRow.canDownload,
          mustChangePassword: guestRow.mustChangePassword,
        },
      };
    }
  );

  // Logout
  fastify.post('/api/logout', async (_req, reply) => {
    reply.clearCookie('guest_token', { path: '/' });
    return { success: true };
  });

  // Protected Guest routes
  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', requireGuest);

    // Current Guest Info
    protectedRoutes.get('/api/me', async (req) => {
      const guest = (req as any).guest;
      return {
        guest: {
          id: guest.id,
          name: guest.name,
          phone: guest.phone,
          status: guest.status,
          canDownload: guest.canDownload,
          mustChangePassword: guest.mustChangePassword,
        },
      };
    });

    // List fellow active event guests (for peer live sharing selection)
    protectedRoutes.get('/api/me/event-guests', async (req) => {
      const guest = (req as any).guest;
      const eventGuests = await db
        .select({
          id: schema.guests.id,
          name: schema.guests.name,
        })
        .from(schema.guests)
        .where(and(eq(schema.guests.eventId, guest.eventId), eq(schema.guests.status, 'active')))
        .orderBy(desc(schema.guests.createdAt));

      return {
        guests: eventGuests.filter((g) => g.id !== guest.id),
      };
    });

    // Active live camera streams available for this guest
    protectedRoutes.get('/api/guest/live-streams', async (req) => {
      const guest = (req as any).guest;
      const now = Date.now();
      const streams = Array.from(guestLiveShareConfigs.values())
        .filter((s) => s.shareMode !== 'off' && now - s.lastFrameTime < 6000 && s.guestId !== guest.id && (s.shareMode === 'all' || s.allowedGuestIds.has(guest.id)))
        .map((s) => ({
          guestId: s.guestId,
          guestName: s.guestName,
          isSharedToAll: s.shareMode === 'all',
          lastFrameTime: s.lastFrameTime,
        }));

      const myConfig = guestLiveShareConfigs.get(guest.id);
      return {
        streams,
        myConfig: myConfig ? {
          shareMode: myConfig.shareMode,
          allowedGuestIds: Array.from(myConfig.allowedGuestIds),
        } : { shareMode: 'off', allowedGuestIds: [] },
      };
    });

    // Update guest live camera share settings
    protectedRoutes.post<{
      Body: {
        shareMode: 'off' | 'host' | 'all' | 'selected';
        allowedGuestIds?: string[];
      };
    }>('/api/guest/live-share-config', async (req) => {
      const guest = (req as any).guest;
      const { shareMode, allowedGuestIds } = req.body || {};
      if (shareMode === 'off' || shareMode === 'host') {
        guestLiveShareConfigs.delete(guest.id);
      } else {
        guestLiveShareConfigs.set(guest.id, {
          guestId: guest.id,
          guestName: guest.name || 'Guest',
          shareMode: shareMode === 'selected' ? 'selected' : 'all',
          allowedGuestIds: new Set(Array.isArray(allowedGuestIds) ? allowedGuestIds : []),
          lastFrameTime: Date.now(),
        });
      }
      broadcastLiveStreamsUpdate();
      return { success: true };
    });

    // Change Password
    protectedRoutes.post<{ Body: { oldPassword?: string; newPassword: string } }>(
      '/api/me/password',
      async (req, reply) => {
        const guest = (req as any).guest;
        const { oldPassword, newPassword } = req.body || {};

        if (!newPassword || newPassword.length < 6) {
          return reply.status(400).send({ error: 'New password must be at least 6 characters' });
        }

        // If not under forced password reset, verify old password
        if (!guest.mustChangePassword) {
          if (!oldPassword) {
            return reply.status(400).send({ error: 'Current password is required' });
          }
          const isCorrect = await verifyPassword(oldPassword, guest.passwordHash);
          if (!isCorrect) {
            return reply.status(401).send({ error: 'Current password is incorrect' });
          }
        }

        const newHash = await hashPassword(newPassword);
        await db
          .update(schema.guests)
          .set({
            passwordHash: newHash,
            mustChangePassword: false,
          })
          .where(eq(schema.guests.id, guest.id));

        return { success: true };
      }
    );

    // Helper to process and store an uploaded video file
    const saveUploadedVideo = async (guest: any, data: any) => {
      const passDir = path.resolve(MEDIA_DIR, guest.id);
      if (!fs.existsSync(passDir)) {
        fs.mkdirSync(passDir, { recursive: true });
      }

      const fileId = crypto.randomUUID();
      const mime = data.mimetype || '';
      const filename = data.filename || '';

      let ext = '.mp4';
      if (mime.includes('webm') || /\.webm$/i.test(filename)) {
        ext = '.webm';
      } else if (mime.includes('quicktime') || /\.mov$/i.test(filename)) {
        ext = '.mov';
      } else if (mime.includes('ogg') || /\.ogv$/i.test(filename)) {
        ext = '.ogv';
      }

      const filePath = path.join(passDir, `${fileId}${ext}`);
      const thumbPath = path.join(passDir, `${fileId}_thumb.jpg`);

      await pipeline(data.file, fs.createWriteStream(filePath));
      const stats = fs.statSync(filePath);

      let hasThumb = false;
      try {
        await execAsync(`ffmpeg -y -ss 00:00:00.500 -i "${filePath}" -vframes 1 -vf "scale=400:-1" "${thumbPath}"`);
        if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
          hasThumb = true;
        }
      } catch {
        // ffmpeg thumbnail optional fallback
      }

      const relPath = `/media-files/${guest.id}/${fileId}${ext}`;
      const relThumb = hasThumb ? `/media-files/${guest.id}/${fileId}_thumb.jpg` : relPath;

      const [newMedia] = await db
        .insert(schema.media)
        .values({
          eventId: guest.eventId,
          guestId: guest.id,
          kind: 'video',
          path: relPath,
          thumbPath: relThumb,
          sizeBytes: stats.size,
          visibility: 'host',
        })
        .returning();

      for (const hostSocket of connectedHosts) {
        if (hostSocket.readyState === 1) {
          hostSocket.send(JSON.stringify({ type: 'new_media', media: newMedia }));
        }
      }

      const guestSockets = connectedGuests.get(guest.id);
      if (guestSockets) {
        for (const gs of guestSockets) {
          if (gs.readyState === 1) {
            gs.send(JSON.stringify({ type: 'gallery_updated', media: newMedia }));
          }
        }
      }

      return newMedia;
    };

    // Upload Photo (multipart) - Auto-routes video files if received
    protectedRoutes.post('/api/upload/photo', async (req, reply) => {
      const guest = (req as any).guest;
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const mime = data.mimetype || '';
      const filename = data.filename || '';
      const isVideo = mime.startsWith('video/') || /\.(mp4|webm|mov|ogv)$/i.test(filename);

      if (isVideo) {
        const media = await saveUploadedVideo(guest, data);
        return { success: true, media };
      }

      const passDir = path.resolve(MEDIA_DIR, guest.id);
      if (!fs.existsSync(passDir)) {
        fs.mkdirSync(passDir, { recursive: true });
      }

      const fileId = crypto.randomUUID();
      const filePath = path.join(passDir, `${fileId}.jpg`);
      const thumbPath = path.join(passDir, `${fileId}_thumb.jpg`);

      // Stream file to disk
      await pipeline(data.file, fs.createWriteStream(filePath));
      const stats = fs.statSync(filePath);

      // Generate 400px thumbnail with sharp
      try {
        await sharp(filePath)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
      } catch (err) {
        // if sharp fails, fallback thumb to original
        fs.copyFileSync(filePath, thumbPath);
      }

      const relPath = `/media-files/${guest.id}/${fileId}.jpg`;
      const relThumb = `/media-files/${guest.id}/${fileId}_thumb.jpg`;

      const [newMedia] = await db
        .insert(schema.media)
        .values({
          eventId: guest.eventId,
          guestId: guest.id,
          kind: 'photo',
          path: relPath,
          thumbPath: relThumb,
          sizeBytes: stats.size,
          visibility: 'host',
        })
        .returning();

      // Notify host sockets of new photo
      for (const hostSocket of connectedHosts) {
        if (hostSocket.readyState === 1) {
          hostSocket.send(JSON.stringify({ type: 'new_media', media: newMedia }));
        }
      }

      // Notify guest sockets of gallery update
      const guestSockets = connectedGuests.get(guest.id);
      if (guestSockets) {
        for (const gs of guestSockets) {
          if (gs.readyState === 1) {
            gs.send(JSON.stringify({ type: 'gallery_updated', media: newMedia }));
          }
        }
      }

      // Fire-and-forget: retain photo upload memory
      retainEventMemory(
        guest.eventId,
        `Guest ${guest.name} uploaded a photo at ${new Date().toISOString()}`,
      ).catch(() => {/* swallowed */});

      return { success: true, media: newMedia };
    });

    // Upload Dedicated Video (multipart)
    protectedRoutes.post('/api/upload/video', async (req, reply) => {
      const guest = (req as any).guest;
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: 'No video uploaded' });
      }

      const media = await saveUploadedVideo(guest, data);
      // Fire-and-forget: retain video upload memory
      retainEventMemory(
        guest.eventId,
        `Guest ${guest.name} uploaded a video at ${new Date().toISOString()}`,
      ).catch(() => {/* swallowed */});
      return { success: true, media };
    });

    // Upload Video Chunk (Supported for progressive streaming)
    const videoUploads = new Map<string, { expectedSeq: number; filePath: string; ext: string }>();

    protectedRoutes.post<{
      Querystring: { id: string; seq: string; ext?: string };
    }>('/api/upload/video-chunk', async (req, reply) => {
      const guest = (req as any).guest;
      const { id, seq, ext = 'mp4' } = req.query;
      const seqNum = parseInt(seq, 10);

      const passDir = path.resolve(MEDIA_DIR, guest.id);
      if (!fs.existsSync(passDir)) fs.mkdirSync(passDir, { recursive: true });

      const fileExt = ext.startsWith('.') ? ext : `.${ext}`;
      const targetPath = path.join(passDir, `${id}${fileExt}`);

      let session = videoUploads.get(id);
      if (!session) {
        session = { expectedSeq: 0, filePath: targetPath, ext: fileExt };
        videoUploads.set(id, session);
      }

      if (seqNum !== session.expectedSeq) {
        return reply.status(409).send({ error: 'Out of order chunk', expected: session.expectedSeq });
      }

      const data = await req.file();
      if (!data) return reply.status(400).send({ error: 'No chunk data' });

      const buffer = await data.toBuffer();
      fs.appendFileSync(targetPath, buffer);
      session.expectedSeq += 1;

      return { success: true, nextSeq: session.expectedSeq };
    });

    // Finalize Video
    protectedRoutes.post<{
      Querystring: { id: string };
    }>('/api/upload/video-done', async (req, reply) => {
      const guest = (req as any).guest;
      const { id } = req.query;

      const session = videoUploads.get(id);
      const passDir = path.resolve(MEDIA_DIR, guest.id);
      let targetPath = session?.filePath;
      let ext = session?.ext || '.mp4';

      if (!targetPath || !fs.existsSync(targetPath)) {
        // Fallback check on disk
        const possibleMp4 = path.join(passDir, `${id}.mp4`);
        const possibleWebm = path.join(passDir, `${id}.webm`);
        if (fs.existsSync(possibleMp4)) {
          targetPath = possibleMp4;
          ext = '.mp4';
        } else if (fs.existsSync(possibleWebm)) {
          targetPath = possibleWebm;
          ext = '.webm';
        } else {
          return reply.status(404).send({ error: 'Video upload session not found' });
        }
      }

      const stats = fs.statSync(targetPath);
      const thumbPath = path.join(passDir, `${id}_thumb.jpg`);
      let hasThumb = false;
      try {
        await execAsync(`ffmpeg -y -ss 00:00:00.500 -i "${targetPath}" -vframes 1 -vf "scale=400:-1" "${thumbPath}"`);
        if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
          hasThumb = true;
        }
      } catch {
        // ignore ffmpeg error
      }

      const relPath = `/media-files/${guest.id}/${id}${ext}`;
      const relThumb = hasThumb ? `/media-files/${guest.id}/${id}_thumb.jpg` : relPath;

      const [newMedia] = await db
        .insert(schema.media)
        .values({
          eventId: guest.eventId,
          guestId: guest.id,
          kind: 'video',
          path: relPath,
          thumbPath: relThumb,
          sizeBytes: stats.size,
          visibility: 'host',
        })
        .returning();

      videoUploads.delete(id);

      for (const hostSocket of connectedHosts) {
        if (hostSocket.readyState === 1) {
          hostSocket.send(JSON.stringify({ type: 'new_media', media: newMedia }));
        }
      }

      const guestSockets = connectedGuests.get(guest.id);
      if (guestSockets) {
        for (const gs of guestSockets) {
          if (gs.readyState === 1) {
            gs.send(JSON.stringify({ type: 'gallery_updated', media: newMedia }));
          }
        }
      }

      return { success: true, media: newMedia };
    });

    // Guest Gallery List (Respects Access Rule strictly!)
    protectedRoutes.get<{
      Querystring: { tab?: 'shared' | 'mine' };
    }>('/api/gallery', async (req) => {
      const guest = (req as any).guest;
      const tab = req.query.tab || 'shared';

      const guestsRows = await db
        .select({ id: schema.guests.id, name: schema.guests.name })
        .from(schema.guests)
        .where(eq(schema.guests.eventId, guest.eventId));
      const guestMap = new Map(guestsRows.map((g) => [g.id, g.name]));

      if (tab === 'mine') {
        const myMedia = await db
          .select()
          .from(schema.media)
          .where(and(eq(schema.media.eventId, guest.eventId), eq(schema.media.guestId, guest.id)))
          .orderBy(desc(schema.media.createdAt));
        const enriched = myMedia.map((m) => ({
          ...m,
          uploaderName: guestMap.get(m.guestId) || guest.name || 'You',
        }));
        return { media: enriched, tab: 'mine' };
      }

      // Shared with this guest: visibility = 'all' OR row in shares for this guest
      const allSharedMedia = await db
        .select()
        .from(schema.media)
        .where(
          and(
            eq(schema.media.eventId, guest.eventId),
            sql`(${schema.media.visibility} = 'all' OR ${schema.media.id} IN (
              SELECT ${schema.shares.mediaId} FROM ${schema.shares} WHERE ${schema.shares.guestId} = ${guest.id}
            ))`
          )
        )
        .orderBy(desc(schema.media.createdAt));

      const enrichedShared = allSharedMedia.map((m) => ({
        ...m,
        uploaderName: guestMap.get(m.guestId) || 'Guest',
      }));

      return { media: enrichedShared, tab: 'shared' };
    });

    // Download All Shared or Mine as Streamed ZIP
    protectedRoutes.get<{
      Querystring: { tab?: 'shared' | 'mine' | 'all'; token?: string };
    }>('/api/zip', async (req, reply) => {
      const guest = (req as any).guest;
      if (!guest.canDownload) {
        return reply.status(403).send({ error: 'Downloads are disabled for your account' });
      }

      const tab = req.query.tab || 'all';
      let whereClause;
      if (tab === 'mine') {
        whereClause = and(
          eq(schema.media.eventId, guest.eventId),
          eq(schema.media.guestId, guest.id)
        );
      } else if (tab === 'shared') {
        whereClause = and(
          eq(schema.media.eventId, guest.eventId),
          sql`(${schema.media.visibility} = 'all' OR ${schema.media.id} IN (
            SELECT ${schema.shares.mediaId} FROM ${schema.shares} WHERE ${schema.shares.guestId} = ${guest.id}
          ))`
        );
      } else {
        whereClause = and(
          eq(schema.media.eventId, guest.eventId),
          sql`(${schema.media.guestId} = ${guest.id} OR ${schema.media.visibility} = 'all' OR ${schema.media.id} IN (
            SELECT ${schema.shares.mediaId} FROM ${schema.shares} WHERE ${schema.shares.guestId} = ${guest.id}
          ))`
        );
      }

      const allowedMedia = await db
        .select()
        .from(schema.media)
        .where(whereClause);

      if (allowedMedia.length === 0) {
        return reply.status(404).send({ error: 'No photos available to download' });
      }

      const existingFiles: { fullPath: string; fileName: string }[] = [];
      const usedNames = new Set<string>();

      for (const m of allowedMedia) {
        const relClean = m.path.replace(/^\/media-files\//, '');
        const fullPath = path.resolve(MEDIA_DIR, relClean);
        if (fs.existsSync(fullPath)) {
          let fileName = path.basename(fullPath);
          if (usedNames.has(fileName)) {
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            fileName = `${base}_${existingFiles.length + 1}${ext}`;
          }
          usedNames.add(fileName);
          existingFiles.push({ fullPath, fileName });
        }
      }

      if (existingFiles.length === 0) {
        return reply.status(404).send({ error: 'No photo files found on server to download' });
      }

      const archive = archiver('zip', { zlib: { level: 5 } });
      archive.on('error', (err) => {
        req.log.error(err, 'ZIP generation error');
      });

      const zipName = `gather-${tab === 'mine' ? 'my' : tab === 'shared' ? 'shared' : 'photos'}.zip`;
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${zipName}"`);

      for (const file of existingFiles) {
        archive.file(file.fullPath, { name: file.fileName });
      }

      archive.finalize();
      return reply.send(archive);
    });

    // Single Media Access (View/Download) - Checked against DB on every request!
    protectedRoutes.get<{
      Params: { id: string };
      Querystring: { download?: string };
    }>('/api/media/:id', async (req, reply) => {
      const guest = (req as any).guest;
      const { id } = req.params;
      const isDownload = req.query.download === '1' || req.query.download === 'true';

      if (isDownload && !guest.canDownload) {
        return reply.status(403).send({ error: 'Downloads are disabled for your account' });
      }

      // Access Rule: active guest AND (own shot OR visibility='all' OR row in shares)
      const [mediaItem] = await db
        .select()
        .from(schema.media)
        .where(
          and(
            eq(schema.media.id, id),
            eq(schema.media.eventId, guest.eventId),
            sql`(${schema.media.guestId} = ${guest.id} OR ${schema.media.visibility} = 'all' OR ${schema.media.id} IN (
              SELECT ${schema.shares.mediaId} FROM ${schema.shares} WHERE ${schema.shares.guestId} = ${guest.id}
            ))`
          )
        )
        .limit(1);

      if (!mediaItem) {
        return reply.status(404).send({ error: 'Media not found or not shared with you' });
      }

      const relClean = mediaItem.path.replace(/^\/media-files\//, '');
      const filePath = path.resolve(MEDIA_DIR, relClean);
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: 'File on disk not found' });
      }

      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (mediaItem.kind === 'photo') {
        contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      } else {
        if (ext === '.webm') contentType = 'video/webm';
        else if (ext === '.mov') contentType = 'video/quicktime';
        else if (ext === '.ogv') contentType = 'video/ogg';
        else contentType = 'video/mp4';
      }

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = end - start + 1;

        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Length', chunksize);
        reply.header('Content-Type', contentType);
        return reply.send(fs.createReadStream(filePath, { start, end }));
      }

      reply.header('Content-Type', contentType);
      reply.header('Content-Length', stats.size);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
      if (isDownload) {
        const downloadExt = ext.replace(/^\./, '') || (mediaItem.kind === 'photo' ? 'jpg' : 'mp4');
        reply.header('Content-Disposition', `attachment; filename="gather-${mediaItem.id.slice(0, 8)}.${downloadExt}"`);
      }

      return reply.send(fs.createReadStream(filePath));
    });

    // Thumbnail Access
    protectedRoutes.get<{
      Params: { id: string };
    }>('/api/media/:id/thumb', async (req, reply) => {
      const guest = (req as any).guest;
      const { id } = req.params;

      const [mediaItem] = await db
        .select()
        .from(schema.media)
        .where(
          and(
            eq(schema.media.id, id),
            eq(schema.media.eventId, guest.eventId),
            sql`(${schema.media.guestId} = ${guest.id} OR ${schema.media.visibility} = 'all' OR ${schema.media.id} IN (
              SELECT ${schema.shares.mediaId} FROM ${schema.shares} WHERE ${schema.shares.guestId} = ${guest.id}
            ))`
          )
        )
        .limit(1);

      if (!mediaItem) {
        return reply.status(404).send({ error: 'Thumbnail not found or not shared with you' });
      }

      const thumbRel = (mediaItem.thumbPath || mediaItem.path).replace(/^\/media-files\//, '');
      const filePath = path.resolve(MEDIA_DIR, thumbRel);
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: 'File on disk not found' });
      }

      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.webm') contentType = 'video/webm';
      else if (ext === '.mov') contentType = 'video/quicktime';
      else if (ext === '.mp4') contentType = 'video/mp4';

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = end - start + 1;

        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Length', chunksize);
        reply.header('Content-Type', contentType);
        return reply.send(fs.createReadStream(filePath, { start, end }));
      }

      reply.header('Content-Type', contentType);
      reply.header('Content-Length', stats.size);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
      return reply.send(fs.createReadStream(filePath));
    });

    // Guest Delete Media (Guests can delete their own uploaded photos/videos)
    protectedRoutes.delete<{ Params: { id: string } }>('/api/media/:id', async (req, reply) => {
      const guest = (req as any).guest;
      const { id } = req.params;

      const [deleted] = await db
        .delete(schema.media)
        .where(
          and(
            eq(schema.media.id, id),
            eq(schema.media.eventId, guest.eventId),
            eq(schema.media.guestId, guest.id)
          )
        )
        .returning();

      if (!deleted) {
        return reply.status(404).send({ error: 'Media not found or you do not have permission to delete it' });
      }

      try {
        const fullPath = path.resolve(MEDIA_DIR, deleted.path.replace(/^\/media-files\//, ''));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        if (deleted.thumbPath) {
          const thumbFullPath = path.resolve(MEDIA_DIR, deleted.thumbPath.replace(/^\/media-files\//, ''));
          if (fs.existsSync(thumbFullPath)) fs.unlinkSync(thumbFullPath);
        }
      } catch {
        // file cleanup ignore
      }

      // Notify host sockets that media was deleted
      for (const hostSocket of connectedHosts) {
        if (hostSocket.readyState === 1) {
          hostSocket.send(JSON.stringify({ type: 'gallery_updated' }));
        }
      }

      // Notify guest sockets
      for (const [, sockets] of connectedGuests) {
        for (const s of sockets) {
          try {
            s.send(JSON.stringify({ type: 'gallery_updated' }));
          } catch {
            // ignore
          }
        }
      }

      return { success: true, media: deleted };
    });

    // List My Guest Share Links
    protectedRoutes.get('/api/me/shares', async (req) => {
      const guest = (req as any).guest;

      const myShares = await db
        .select()
        .from(schema.guestShares)
        .where(eq(schema.guestShares.guestId, guest.id))
        .orderBy(desc(schema.guestShares.createdAt));

      const publicBase = process.env.PUBLIC_URL || `${req.protocol}://${req.host}`;

      // Fetch item counts for each share
      const result = await Promise.all(
        myShares.map(async (s) => {
          let itemCount = 0;
          if (s.isAllMyUploads) {
            const [cnt] = await db
              .select({ count: sql<number>`count(*)` })
              .from(schema.media)
              .where(and(eq(schema.media.eventId, guest.eventId), eq(schema.media.guestId, guest.id)));
            itemCount = Number(cnt?.count || 0);
          } else {
            const [cnt] = await db
              .select({ count: sql<number>`count(*)` })
              .from(schema.guestShareItems)
              .where(eq(schema.guestShareItems.shareId, s.id));
            itemCount = Number(cnt?.count || 0);
          }

          return {
            id: s.id,
            slug: s.slug,
            shareUrl: `${publicBase}/s/${s.slug}`,
            title: s.title || (s.isAllMyUploads ? 'All My Uploads' : 'Curated Selection'),
            isAllMyUploads: s.isAllMyUploads,
            hasPassword: !!s.passwordHash,
            expiresAt: s.expiresAt,
            createdAt: s.createdAt,
            itemCount,
          };
        })
      );

      return { shares: result, publicBase };
    });

    // Create a Guest Share Link
    protectedRoutes.post<{
      Body: {
        title?: string;
        isAllMyUploads?: boolean;
        mediaIds?: string[];
        password?: string;
        expiresInHours?: number;
      };
    }>('/api/me/shares', async (req, reply) => {
      const guest = (req as any).guest;
      const { title, isAllMyUploads = false, mediaIds = [], password, expiresInHours } = req.body;

      if (!isAllMyUploads && (!Array.isArray(mediaIds) || mediaIds.length === 0)) {
        return reply.status(400).send({ error: 'Please select at least one photo or video to share' });
      }

      // If specific mediaIds, verify guest is allowed to share them (own uploads or visible in event)
      let validMediaIds: string[] = [];
      if (!isAllMyUploads) {
        const allowedMedia = await db
          .select({ id: schema.media.id })
          .from(schema.media)
          .where(
            and(
              eq(schema.media.eventId, guest.eventId),
              inArray(schema.media.id, mediaIds),
              sql`(${schema.media.guestId} = ${guest.id} OR ${schema.media.visibility} = 'all' OR ${schema.media.id} IN (
                SELECT ${schema.shares.mediaId} FROM ${schema.shares} WHERE ${schema.shares.guestId} = ${guest.id}
              ))`
            )
          );
        validMediaIds = allowedMedia.map((m) => m.id);
        if (validMediaIds.length === 0) {
          return reply.status(400).send({ error: 'None of the selected media items are valid for sharing' });
        }
      }

      // Generate a unique 8-char slug
      let slug = crypto.randomBytes(4).toString('hex');
      while (true) {
        const [existing] = await db
          .select({ id: schema.guestShares.id })
          .from(schema.guestShares)
          .where(eq(schema.guestShares.slug, slug))
          .limit(1);
        if (!existing) break;
        slug = crypto.randomBytes(4).toString('hex');
      }

      let passwordHash: string | null = null;
      if (password && password.trim().length > 0) {
        passwordHash = await hashPassword(password.trim());
      }

      let expiresAt: Date | null = null;
      if (expiresInHours && expiresInHours > 0) {
        expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
      }

      const [newShare] = await db
        .insert(schema.guestShares)
        .values({
          eventId: guest.eventId,
          guestId: guest.id,
          slug,
          title: title?.trim() || null,
          isAllMyUploads,
          passwordHash,
          expiresAt,
        })
        .returning();

      if (!isAllMyUploads && validMediaIds.length > 0) {
        await db.insert(schema.guestShareItems).values(
          validMediaIds.map((mId) => ({
            shareId: newShare.id,
            mediaId: mId,
          }))
        );
      }

      const publicBase = process.env.PUBLIC_URL || `${req.protocol}://${req.host}`;

      return {
        success: true,
        share: {
          id: newShare.id,
          slug: newShare.slug,
          shareUrl: `${publicBase}/s/${newShare.slug}`,
          title: newShare.title,
          isAllMyUploads: newShare.isAllMyUploads,
          hasPassword: !!newShare.passwordHash,
          expiresAt: newShare.expiresAt,
          createdAt: newShare.createdAt,
          itemCount: isAllMyUploads ? undefined : validMediaIds.length,
        },
      };
    });

    // Delete / Revoke a Guest Share Link
    protectedRoutes.delete<{ Params: { id: string } }>('/api/me/shares/:id', async (req, reply) => {
      const guest = (req as any).guest;
      const { id } = req.params;

      const [deleted] = await db
        .delete(schema.guestShares)
        .where(and(eq(schema.guestShares.id, id), eq(schema.guestShares.guestId, guest.id)))
        .returning();

      if (!deleted) {
        return reply.status(404).send({ error: 'Share link not found or already deleted' });
      }

      return { success: true };
    });
  });
}
