import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface HostAuthPayload {
  role: 'host';
  eventId: string;
}

export interface GuestAuthPayload {
  role: 'guest';
  guestId: string;
  eventId: string;
}

export async function requireHost(req: FastifyRequest, reply: FastifyReply) {
  const hostToken = req.cookies.host_token;
  if (!hostToken) {
    return reply.status(401).send({ error: 'Unauthorized: host login required' });
  }

  try {
    const payload = req.server.jwt.verify<HostAuthPayload>(hostToken);
    if (payload.role !== 'host') {
      return reply.status(403).send({ error: 'Forbidden: host access only' });
    }
    (req as any).hostAuth = payload;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized: invalid host session' });
  }
}

export async function requireGuest(req: FastifyRequest, reply: FastifyReply) {
  let guestToken = req.cookies.guest_token;
  if (!guestToken && req.headers.authorization?.startsWith('Bearer ')) {
    guestToken = req.headers.authorization.slice(7).trim();
  }
  if (!guestToken && (req.query as any)?.token) {
    guestToken = (req.query as any).token;
  }

  if (!guestToken) {
    return reply.status(401).send({ error: 'Unauthorized: guest login required' });
  }

  let payload: GuestAuthPayload;
  try {
    payload = req.server.jwt.verify<GuestAuthPayload>(guestToken);
  } catch {
    return reply.status(401).send({ error: 'Unauthorized: invalid guest session' });
  }

  // Mandatory invariant: Query DB on EVERY request so blocked guests are kicked instantly
  const [guestRow] = await db
    .select()
    .from(schema.guests)
    .where(eq(schema.guests.id, payload.guestId))
    .limit(1);

  if (!guestRow) {
    return reply.status(401).send({ error: 'Guest not found' });
  }

  if (guestRow.status === 'blocked') {
    return reply.status(403).send({ error: 'Account blocked by host', blocked: true });
  }

  if (guestRow.status === 'pending') {
    return reply.status(403).send({ error: 'Waiting for host approval', pending: true });
  }

  (req as any).guest = guestRow;
}
