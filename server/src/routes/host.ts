import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { generateSlug, generateTempCode } from '../utils/slug.js';
import { requireHost } from '../middleware/auth.js';
import { eq, desc, and, inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { connectedGuests, MEDIA_DIR, VOICE_DIR } from '../index.js';
import { recallEventMemory, isHindsightEnabled } from '../services/hindsight.js';

export async function hostRoutes(fastify: FastifyInstance) {
  // Public status check
  fastify.get('/api/host/status', async (_req, reply) => {
    const allEvents = await db
      .select({
        id: schema.event.id,
        name: schema.event.name,
        date: schema.event.date,
        slug: schema.event.slug,
        joinOpen: schema.event.joinOpen,
        requireApproval: schema.event.requireApproval,
      })
      .from(schema.event)
      .orderBy(desc(schema.event.id));

    return {
      hasEvent: allEvents.length > 0,
      event: allEvents[0] || null,
      events: allEvents,
    };
  });

  // Setup Event (only works once)
  fastify.post<{ Body: { name: string; date?: string; password: string } }>(
    '/api/host/setup',
    async (req, reply) => {
      const { name, date, password } = req.body || {};
      if (!name || !password || password.length < 6) {
        return reply.status(400).send({ error: 'Name and password (min 6 chars) required' });
      }

      // Allow creating additional events
      const hostPwHash = await hashPassword(password);
      const slug = generateSlug(name);

      const [newEvent] = await db
        .insert(schema.event)
        .values({
          name,
          date: date || null,
          slug,
          hostPwHash,
          joinOpen: true,
          requireApproval: false,
        })
        .returning();

      const token = fastify.jwt.sign({ role: 'host', eventId: newEvent.id });
      reply.setCookie('host_token', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      });

      return {
        success: true,
        event: {
          id: newEvent.id,
          name: newEvent.name,
          date: newEvent.date,
          slug: newEvent.slug,
          joinOpen: newEvent.joinOpen,
          requireApproval: newEvent.requireApproval,
        },
      };
    }
  );

  // Host Login
  fastify.post<{ Body: { password: string; eventId?: string } }>(
    '/api/host/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (req, reply) => {
      const { password, eventId } = req.body || {};
      if (!password) {
        return reply.status(400).send({ error: 'Password required' });
      }

      let existingEvent;
      if (eventId) {
        const [found] = await db.select().from(schema.event).where(eq(schema.event.id, eventId)).limit(1);
        existingEvent = found;
      }
      if (!existingEvent) {
        const [first] = await db.select().from(schema.event).limit(1);
        existingEvent = first;
      }

      if (!existingEvent) {
        return reply.status(404).send({ error: 'No event setup yet. Please run setup first.' });
      }

      const isValid = await verifyPassword(password, existingEvent.hostPwHash);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid host password' });
      }

      const token = fastify.jwt.sign({ role: 'host', eventId: existingEvent.id });
      reply.setCookie('host_token', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      });

      return {
        success: true,
        event: {
          id: existingEvent.id,
          name: existingEvent.name,
          date: existingEvent.date,
          slug: existingEvent.slug,
        },
      };
    }
  );

  // Host Logout
  fastify.post('/api/host/logout', async (_req, reply) => {
    reply.clearCookie('host_token', { path: '/', sameSite: 'none', secure: true });
    return { success: true };
  });

  // Protected Host API routes
  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', requireHost);

    // Saved guest voice messages (host can listen later)
    protectedRoutes.get('/api/host/voice-messages', async (req) => {
      const hostAuth = (req as any).hostAuth;
      const files = (await fs.promises.readdir(VOICE_DIR)).filter((f) => f.endsWith('.json'));
      const metas = await Promise.all(
        files.map(async (f) => {
          try {
            return JSON.parse(await fs.promises.readFile(path.join(VOICE_DIR, f), 'utf8'));
          } catch {
            return null;
          }
        })
      );
      const messages = metas
        .filter((m) => m && (!hostAuth?.eventId || m.eventId === hostAuth.eventId))
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 100);
      return { messages };
    });

    protectedRoutes.get<{ Params: { id: string } }>('/api/host/voice-messages/:id/audio', async (req, reply) => {
      const { id } = req.params;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.status(400).send({ error: 'Invalid id' });
      const wavPath = path.join(VOICE_DIR, `${id}.wav`);
      if (!fs.existsSync(wavPath)) return reply.status(404).send({ error: 'Not found' });
      return reply.type('audio/wav').send(fs.createReadStream(wavPath));
    });

    // List all events created by host
    protectedRoutes.get('/api/host/events', async () => {
      const allEvents = await db.select().from(schema.event).orderBy(desc(schema.event.date));
      return { events: allEvents };
    });

    // Switch active event session
    protectedRoutes.post<{ Body: { eventId: string } }>('/api/host/events/switch', async (req, reply) => {
      const { eventId } = req.body || {};
      const [target] = await db.select().from(schema.event).where(eq(schema.event.id, eventId)).limit(1);
      if (!target) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const token = fastify.jwt.sign({ role: 'host', eventId: target.id });
      reply.setCookie('host_token', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      });

      return { success: true, event: target };
    });

    // Delete an event
    protectedRoutes.delete<{ Params: { id: string } }>('/api/host/events/:id', async (req, reply) => {
      const { id } = req.params;
      const [deleted] = await db.delete(schema.event).where(eq(schema.event.id, id)).returning();
      if (!deleted) {
        return reply.status(404).send({ error: 'Event not found' });
      }
      return { success: true, event: deleted };
    });

    // Host session / event details
    protectedRoutes.get('/api/host/event', async (req) => {
      const hostAuth = (req as any).hostAuth;
      let existing;
      if (hostAuth?.eventId) {
        [existing] = await db.select().from(schema.event).where(eq(schema.event.id, hostAuth.eventId)).limit(1);
      }
      if (!existing) {
        [existing] = await db.select().from(schema.event).limit(1);
      }
      const publicUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.host}`;
      return {
        event: existing || null,
        joinUrl: existing ? `${publicUrl}/e/${existing.slug}` : null,
      };
    });

    // Update event properties (joinOpen, requireApproval, name, date)
    protectedRoutes.patch<{
      Body: {
        eventId?: string;
        name?: string;
        date?: string;
        joinOpen?: boolean;
        requireApproval?: boolean;
      };
    }>('/api/host/event', async (req, reply) => {
      const { eventId, name, date, joinOpen, requireApproval } = req.body || {};
      const hostAuth = (req as any).hostAuth;
      const targetId = eventId || hostAuth?.eventId;
      let existing;
      if (targetId) {
        [existing] = await db.select().from(schema.event).where(eq(schema.event.id, targetId)).limit(1);
      }
      if (!existing) {
        [existing] = await db.select().from(schema.event).limit(1);
      }
      if (!existing) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const updateData: Partial<typeof schema.event.$inferInsert> = {};
      if (name !== undefined) updateData.name = name;
      if (date !== undefined) updateData.date = date;
      if (joinOpen !== undefined) updateData.joinOpen = joinOpen;
      if (requireApproval !== undefined) updateData.requireApproval = requireApproval;

      const [updated] = await db
        .update(schema.event)
        .set(updateData)
        .where(eq(schema.event.id, existing.id))
        .returning();

      const publicUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.host}`;
      return {
        success: true,
        event: updated,
        joinUrl: updated ? `${publicUrl}/e/${updated.slug}` : null,
      };
    });

    // List all guests with their shots count and shared items count
    protectedRoutes.get('/api/host/guests', async (req) => {
      const hostAuth = (req as any).hostAuth;
      let allGuests;
      if (hostAuth?.eventId) {
        allGuests = await db
          .select()
          .from(schema.guests)
          .where(eq(schema.guests.eventId, hostAuth.eventId))
          .orderBy(desc(schema.guests.createdAt));
      } else {
        allGuests = await db
          .select()
          .from(schema.guests)
          .orderBy(desc(schema.guests.createdAt));
      }

      const mediaRows = await db.select().from(schema.media);
      const shareRows = await db.select().from(schema.shares);

      const guestsWithStats = allGuests.map((g) => {
        const shotsCount = mediaRows.filter((m) => m.guestId === g.id).length;
        const sharedWithThemCount = shareRows.filter((s) => s.guestId === g.id).length;
        return {
          ...g,
          shotsCount,
          sharedWithThemCount,
        };
      });

      return { guests: guestsWithStats };
    });

    // Update guest (approve, block, activate, canDownload)
    protectedRoutes.patch<{
      Params: { id: string };
      Body: {
        status?: 'active' | 'blocked' | 'pending';
        canDownload?: boolean;
      };
    }>('/api/host/guests/:id', async (req, reply) => {
      const { id } = req.params;
      const { status, canDownload } = req.body || {};

      const updateData: Partial<typeof schema.guests.$inferInsert> = {};
      if (status !== undefined) updateData.status = status;
      if (canDownload !== undefined) updateData.canDownload = canDownload;

      const [updated] = await db
        .update(schema.guests)
        .set(updateData)
        .where(eq(schema.guests.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'Guest not found' });
      }

      // If blocked, immediately disconnect their active WebSocket
      if (status === 'blocked') {
        const sockets = connectedGuests.get(id);
        if (sockets) {
          for (const s of sockets) {
            try {
              s.send(JSON.stringify({ type: 'blocked', message: 'You have been blocked by the host.' }));
              s.close();
            } catch {
              // closed
            }
          }
          connectedGuests.delete(id);
        }
      }

      return { success: true, guest: updated };
    });

    // Reset guest password (returns a 6-digit temp code to the host)
    protectedRoutes.post<{ Params: { id: string } }>(
      '/api/host/guests/:id/reset-password',
      async (req, reply) => {
        const { id } = req.params;
        const tempCode = generateTempCode();
        const passwordHash = await hashPassword(tempCode);

        const [updated] = await db
          .update(schema.guests)
          .set({
            passwordHash,
            mustChangePassword: true,
          })
          .where(eq(schema.guests.id, id))
          .returning();

        if (!updated) {
          return reply.status(404).send({ error: 'Guest not found' });
        }

        return {
          success: true,
          guest: updated,
          tempCode,
        };
      }
    );

    // Delete guest permanently
    protectedRoutes.delete<{ Params: { id: string } }>('/api/host/guests/:id', async (req, reply) => {
      const { id } = req.params;

      const sockets = connectedGuests.get(id);
      if (sockets) {
        for (const s of sockets) {
          try {
            s.send(JSON.stringify({ type: 'deleted' }));
            s.close();
          } catch {
            // closed
          }
        }
        connectedGuests.delete(id);
      }

      const [deleted] = await db.delete(schema.guests).where(eq(schema.guests.id, id)).returning();
      if (!deleted) {
        return reply.status(404).send({ error: 'Guest not found' });
      }

      return { success: true, guest: deleted };
    });

    // Overview stats
    protectedRoutes.get('/api/host/overview', async (req) => {
      const hostAuth = (req as any).hostAuth;
      let eventRow;
      if (hostAuth?.eventId) {
        [eventRow] = await db.select().from(schema.event).where(eq(schema.event.id, hostAuth.eventId)).limit(1);
      }
      if (!eventRow) {
        [eventRow] = await db.select().from(schema.event).limit(1);
      }

      const allGuests = eventRow
        ? await db.select().from(schema.guests).where(eq(schema.guests.eventId, eventRow.id))
        : [];
      const allMedia = eventRow
        ? await db.select().from(schema.media).where(eq(schema.media.eventId, eventRow.id))
        : [];

      let photosCount = 0;
      let videosCount = 0;
      let totalBytes = 0;

      for (const m of allMedia) {
        if (m.kind === 'photo') photosCount++;
        if (m.kind === 'video') videosCount++;
        totalBytes += Number(m.sizeBytes || 0);
      }

      let diskStats = { free: 0, total: 0 };
      try {
        const stat = fs.statfsSync(path.resolve('./data/media'));
        diskStats = {
          free: stat.bfree * stat.bsize,
          total: stat.blocks * stat.bsize,
        };
      } catch {
        // statfs fallback
      }

      return {
        event: eventRow,
        guestsCount: allGuests.length,
        activeGuestsCount: allGuests.filter((g) => g.status === 'active').length,
        pendingGuestsCount: allGuests.filter((g) => g.status === 'pending').length,
        connectedCamerasCount: connectedGuests.size,
        photosCount,
        videosCount,
        totalBytes,
        diskStats,
      };
    });

    // Host Gallery Media List
    protectedRoutes.get<{
      Querystring: {
        guestId?: string;
        kind?: 'photo' | 'video';
        visibility?: 'host' | 'selected' | 'all';
      };
    }>('/api/host/media', async (req) => {
      const hostAuth = (req as any).hostAuth;
      const { guestId, kind, visibility } = req.query;

      let eventRow;
      if (hostAuth?.eventId) {
        [eventRow] = await db.select().from(schema.event).where(eq(schema.event.id, hostAuth.eventId)).limit(1);
      }
      if (!eventRow) {
        [eventRow] = await db.select().from(schema.event).limit(1);
      }

      if (!eventRow) {
        return { media: [] };
      }

      const mediaRows = await db
        .select()
        .from(schema.media)
        .where(eq(schema.media.eventId, eventRow.id))
        .orderBy(desc(schema.media.createdAt));

      const guestsRows = await db.select().from(schema.guests).where(eq(schema.guests.eventId, eventRow.id));
      const guestMap = new Map(guestsRows.map((g) => [g.id, g.name]));

      const sharesRows = await db.select().from(schema.shares);

      let filtered = mediaRows;
      if (guestId) filtered = filtered.filter((m) => m.guestId === guestId);
      if (kind) filtered = filtered.filter((m) => m.kind === kind);
      if (visibility) filtered = filtered.filter((m) => m.visibility === visibility);

      const result = filtered.map((m) => {
        const itemShares = sharesRows.filter((s) => s.mediaId === m.id);
        const sharedGuestIds = itemShares.map((s) => s.guestId);
        const sharedGuestNames = sharedGuestIds.map((id) => guestMap.get(id)).filter(Boolean);

        return {
          ...m,
          uploaderName: guestMap.get(m.guestId) || 'Unknown Guest',
          sharedGuestIds,
          sharedGuestNames,
        };
      });

      return { media: result, total: result.length };
    });

    // Share Media with Guests or Everyone
    protectedRoutes.post<{
      Body: {
        mediaIds: string[];
        guestIds?: string[];
        everyone?: boolean;
        makePrivate?: boolean;
      };
    }>('/api/host/share', async (req, reply) => {
      const { mediaIds, guestIds = [], everyone, makePrivate } = req.body || {};

      if (!mediaIds || mediaIds.length === 0) {
        return reply.status(400).send({ error: 'No media items specified' });
      }

      for (const mediaId of mediaIds) {
        if (makePrivate) {
          await db.delete(schema.shares).where(eq(schema.shares.mediaId, mediaId));
          await db
            .update(schema.media)
            .set({ visibility: 'host' })
            .where(eq(schema.media.id, mediaId));
        } else if (everyone) {
          await db
            .update(schema.media)
            .set({ visibility: 'all' })
            .where(eq(schema.media.id, mediaId));
        } else if (guestIds.length > 0) {
          await db
            .update(schema.media)
            .set({ visibility: 'selected' })
            .where(eq(schema.media.id, mediaId));

          for (const gId of guestIds) {
            // Check if share row already exists
            const [exists] = await db
              .select()
              .from(schema.shares)
              .where(and(eq(schema.shares.mediaId, mediaId), eq(schema.shares.guestId, gId)))
              .limit(1);

            if (!exists) {
              await db.insert(schema.shares).values({
                mediaId,
                guestId: gId,
              });
            }
          }
        }
      }

      // Broadcast gallery update event to all connected guest sockets
      for (const [guestId, sockets] of connectedGuests) {
        for (const s of sockets) {
          try {
            s.send(JSON.stringify({ type: 'gallery_updated' }));
          } catch {
            // socket closed
          }
        }
      }

      return { success: true };
    });

    // Delete Media
    protectedRoutes.delete<{ Params: { id: string } }>('/api/host/media/:id', async (req, reply) => {
      const { id } = req.params;
      const [deleted] = await db.delete(schema.media).where(eq(schema.media.id, id)).returning();
      if (!deleted) {
        return reply.status(404).send({ error: 'Media not found' });
      }

      try {
        const fullPath = path.resolve(MEDIA_DIR, deleted.path.replace(/^\/media-files\//, ''));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        if (deleted.thumbPath) {
          const thumbFullPath = path.resolve(MEDIA_DIR, deleted.thumbPath.replace(/^\/media-files\//, ''));
          if (fs.existsSync(thumbFullPath)) fs.unlinkSync(thumbFullPath);
        }
      } catch {
        // file cleanup error ignore
      }

      // Broadcast gallery update event to all connected guest sockets
      for (const [, sockets] of connectedGuests) {
        for (const s of sockets) {
          try {
            s.send(JSON.stringify({ type: 'gallery_updated' }));
          } catch {
            // socket closed
          }
        }
      }

      return { success: true, media: deleted };
    });

    // Batch Delete Media
    protectedRoutes.post<{ Body: { ids: string[] } }>('/api/host/media/batch-delete', async (req, reply) => {
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ error: 'Array of media ids required' });
      }

      const deletedItems = await db
        .delete(schema.media)
        .where(inArray(schema.media.id, ids))
        .returning();

      for (const item of deletedItems) {
        try {
          const fullPath = path.resolve(MEDIA_DIR, item.path.replace(/^\/media-files\//, ''));
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          if (item.thumbPath) {
            const thumbFullPath = path.resolve(MEDIA_DIR, item.thumbPath.replace(/^\/media-files\//, ''));
            if (fs.existsSync(thumbFullPath)) fs.unlinkSync(thumbFullPath);
          }
        } catch {
          // ignore disk cleanup failures
        }
      }

      // Broadcast gallery update to guests
      for (const [, sockets] of connectedGuests) {
        for (const s of sockets) {
          try {
            s.send(JSON.stringify({ type: 'gallery_updated' }));
          } catch {
            // socket closed
          }
        }
      }

      return { success: true, count: deletedItems.length, deleted: deletedItems };
    });

    // ── Hindsight AI Memory: Recall ───────────────────────────────────────────
    protectedRoutes.post<{ Body: { query: string } }>(
      '/api/host/memory/recall',
      {
        config: {
          rateLimit: {
            max: 10,
            timeWindow: '1 minute',
          },
        },
      },
      async (req, reply) => {
        const hostAuth = (req as any).hostAuth;
        const { query } = req.body || {};

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          return reply.status(400).send({ error: 'query is required' });
        }
        if (query.length > 500) {
          return reply.status(400).send({ error: 'query must be 500 characters or fewer' });
        }

        // Resolve the current event ID from the host session
        let eventId: string | undefined = hostAuth?.eventId;
        if (!eventId) {
          const [first] = await db.select({ id: schema.event.id }).from(schema.event).limit(1);
          eventId = first?.id;
        }
        if (!eventId) {
          return reply.status(404).send({ error: 'No event found' });
        }

        if (!isHindsightEnabled()) {
          return { results: [], unavailable: true };
        }

        const result = await recallEventMemory(eventId, query.trim());
        if (!result) {
          return { results: [], unavailable: true };
        }

        return { results: result.results };
      },
    );
  });
}
