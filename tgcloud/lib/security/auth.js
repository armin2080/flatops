// auth.js — participant identification and authorization.
//
// Identity is ALWAYS derived from the immutable Telegram numeric user id.
// Mini App endpoints receive the verified `ctx.initData.user.id` from the
// platform; the bot handlers receive `message.from.id`. Usernames are never
// used for authorization.

import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { participants } from '../../schema.js';

/**
 * Fetch an active participant by Telegram user id, or null.
 */
export async function getParticipantByTgId(tgId) {
  if (tgId == null) return null;
  const row = await db.select()
    .from(participants)
    .where(eq(participants.tgId, tgId))
    .get();
  if (!row) return null;
  if (row.isActive === false) return null;
  return row;
}

/**
 * Fetch the participant or throw an EndpointError (for Mini App endpoints).
 */
export async function requireParticipantByTgId(tgId) {
  const p = await getParticipantByTgId(tgId);
  if (!p) throw new EndpointError('You are not an authorised participant.', { code: 'UNAUTHORIZED' });
  return p;
}

/**
 * Fetch the participant or return null (for bot handlers, which reply instead).
 */
export async function authorizeTgId(tgId) {
  return getParticipantByTgId(tgId);
}

/**
 * The two participants ordered so that Person A is the lower id. Returns
 * `{ a, b }` or `{ a, b: null }` when only one participant exists.
 */
export async function getOrderedParticipants() {
  const rows = await db.select().from(participants).all();
  const active = rows.filter((r) => r.isActive !== false);
  const sorted = [...active].sort((x, y) => x.id - y.id);
  return { a: sorted[0] ?? null, b: sorted[1] ?? null };
}

/**
 * Number of active participants.
 */
export async function participantCount() {
  const rows = await db.select().from(participants).all();
  return rows.filter((r) => r.isActive !== false).length;
}
