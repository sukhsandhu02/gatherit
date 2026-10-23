import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { requireHost } from '../middleware/auth.js';
import { eq } from 'drizzle-orm';

export async function joinPageRoutes(fastify: FastifyInstance) {
  // Public endpoint for guest join page copy
  fastify.get<{ Params: { slug: string } }>('/api/events/:slug/join-page', async (req, reply) => {
    const { slug } = req.params;

    const [eventRow] = await db
      .select()
      .from(schema.event)
      .where(eq(schema.event.slug, slug))
      .limit(1);

    if (!eventRow) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    return {
      event: {
        id: eventRow.id,
        name: eventRow.name,
        slug: eventRow.slug,
      },
      joinPage: {
        title: eventRow.joinPageTitle || null,
        subtitle: eventRow.joinPageSubtitle || null,
        instructions: eventRow.joinPageInstructions || null,
        joinButton: eventRow.joinPageJoinButton || null,
        loginButton: eventRow.joinPageLoginButton || null,
        namePlaceholder: eventRow.joinPageNamePlaceholder || null,
        phonePlaceholder: eventRow.joinPagePhonePlaceholder || null,
        passwordPlaceholder: eventRow.joinPagePasswordPlaceholder || null,
        nameRequired: eventRow.joinPageNameRequired,
        phoneRequired: eventRow.joinPagePhoneRequired,
        passwordRequired: eventRow.joinPagePasswordRequired,
        pendingNote: eventRow.joinPagePendingNote || null,
        blockedNote: eventRow.joinPageBlockedNote || null,
      },
    };
  });

  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', requireHost);

    protectedRoutes.get('/api/host/event/join-page', async (req) => {
      const hostAuth = (req as any).hostAuth;
      let existing;
      if (hostAuth?.eventId) {
        [existing] = await db
          .select()
          .from(schema.event)
          .where(eq(schema.event.id, hostAuth.eventId))
          .limit(1);
      }
      if (!existing) {
        [existing] = await db.select().from(schema.event).limit(1);
      }

      if (!existing) {
        return { event: null, joinPage: null };
      }

      return {
        event: {
          id: existing.id,
          name: existing.name,
          slug: existing.slug,
        },
        joinPage: {
          title: existing.joinPageTitle || null,
          subtitle: existing.joinPageSubtitle || null,
          instructions: existing.joinPageInstructions || null,
          joinButton: existing.joinPageJoinButton || null,
          loginButton: existing.joinPageLoginButton || null,
          namePlaceholder: existing.joinPageNamePlaceholder || null,
          phonePlaceholder: existing.joinPagePhonePlaceholder || null,
          passwordPlaceholder: existing.joinPagePasswordPlaceholder || null,
          nameRequired: existing.joinPageNameRequired,
          phoneRequired: existing.joinPagePhoneRequired,
          passwordRequired: existing.joinPagePasswordRequired,
          pendingNote: existing.joinPagePendingNote || null,
          blockedNote: existing.joinPageBlockedNote || null,
        },
      };
    });

    protectedRoutes.patch<{
      Body: {
        title?: string;
        subtitle?: string;
        instructions?: string;
        joinButton?: string;
        loginButton?: string;
        namePlaceholder?: string;
        phonePlaceholder?: string;
        passwordPlaceholder?: string;
        nameRequired?: boolean;
        phoneRequired?: boolean;
        passwordRequired?: boolean;
        pendingNote?: string;
        blockedNote?: string;
      };
    }>('/api/host/event/join-page', async (req, reply) => {
      const body = req.body || {};
      const hostAuth = (req as any).hostAuth;
      let existing;
      if (hostAuth?.eventId) {
        [existing] = await db
          .select()
          .from(schema.event)
          .where(eq(schema.event.id, hostAuth.eventId))
          .limit(1);
      }
      if (!existing) {
        [existing] = await db.select().from(schema.event).limit(1);
      }

      if (!existing) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const set: Partial<typeof schema.event.$inferInsert> = {};
      if (body.title !== undefined) set.joinPageTitle = body.title;
      if (body.subtitle !== undefined) set.joinPageSubtitle = body.subtitle;
      if (body.instructions !== undefined) set.joinPageInstructions = body.instructions;
      if (body.joinButton !== undefined) set.joinPageJoinButton = body.joinButton;
      if (body.loginButton !== undefined) set.joinPageLoginButton = body.loginButton;
      if (body.namePlaceholder !== undefined) set.joinPageNamePlaceholder = body.namePlaceholder;
      if (body.phonePlaceholder !== undefined) set.joinPagePhonePlaceholder = body.phonePlaceholder;
      if (body.passwordPlaceholder !== undefined) set.joinPagePasswordPlaceholder = body.passwordPlaceholder;
      if (body.nameRequired !== undefined) set.joinPageNameRequired = body.nameRequired;
      if (body.phoneRequired !== undefined) set.joinPagePhoneRequired = body.phoneRequired;
      if (body.passwordRequired !== undefined) set.joinPagePasswordRequired = body.passwordRequired;
      if (body.pendingNote !== undefined) set.joinPagePendingNote = body.pendingNote;
      if (body.blockedNote !== undefined) set.joinPageBlockedNote = body.blockedNote;

      const [updated] = await db
        .update(schema.event)
        .set(set)
        .where(eq(schema.event.id, existing.id))
        .returning();

      return {
        success: true,
        joinPage: {
          title: updated.joinPageTitle || null,
          subtitle: updated.joinPageSubtitle || null,
          instructions: updated.joinPageInstructions || null,
          joinButton: updated.joinPageJoinButton || null,
          loginButton: updated.joinPageLoginButton || null,
          namePlaceholder: updated.joinPageNamePlaceholder || null,
          phonePlaceholder: updated.joinPagePhonePlaceholder || null,
          passwordPlaceholder: updated.joinPagePasswordPlaceholder || null,
          nameRequired: updated.joinPageNameRequired,
          phoneRequired: updated.joinPagePhoneRequired,
          passwordRequired: updated.joinPagePasswordRequired,
          pendingNote: updated.joinPagePendingNote || null,
          blockedNote: updated.joinPageBlockedNote || null,
        },
      };
    });
  });
}
