// store/balance.js — read-side queries for balance and history.

import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { receipts, settlements, participants } from '../../schema.js';

/**
 * Load all settlement rows.
 */
export async function getSettlements() {
  return db.select().from(settlements).all();
}

/**
 * Load confirmed receipt rows (without children).
 */
export async function getConfirmedReceipts() {
  return db.select().from(receipts).where(eq(receipts.status, 'confirmed')).all();
}

/**
 * Recent receipts (any status), newest first.
 */
export async function recentReceipts(limit = 20) {
  return db.select()
    .from(receipts)
    .orderBy(desc(receipts.id))
    .limit(limit)
    .all();
}

/**
 * Recent settlements, newest first.
 */
export async function recentSettlements(limit = 20) {
  return db.select()
    .from(settlements)
    .orderBy(desc(settlements.id))
    .limit(limit)
    .all();
}

/**
 * Map of participant id -> display name.
 */
export async function participantNameMap() {
  const rows = await db.select().from(participants).all();
  const map = {};
  for (const r of rows) map[r.id] = r.displayName || `User ${r.tgId}`;
  return map;
}
