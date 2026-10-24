// store/receipts.js — database access for receipts, items, and adjustments.
// Shared by the Mini App endpoints and the bot handlers. Business rules live in
// the pure `lib/*` modules; this file wires them to SQLite.

import { db, EndpointError } from 'sdk';
import { eq, asc, and, ne } from 'sdk/db';

import {
  receipts, receiptItems, adjustments, allocationPreferences, settlements, participants,
} from '../../schema.js';
import { splitCents, normalizeAllocationType, ALLOC_CUSTOM } from '../allocation/allocation.js';
import { suggestAllocation, buildPreferenceMap, preferenceRowFromAllocation } from '../allocation/preferences.js';
import { receiptResponsibility, computeBalance } from '../ledger/ledger.js';
import { calculatedTotalCents, discrepancyCents } from '../receipts/reconcile.js';
import { getOrderedParticipants } from '../security/auth.js';
import { getSettlements } from './balance.js';

export const STATUS = {
  PROCESSING: 'processing',
  AWAITING_REVIEW: 'awaiting_review',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};

function validateLineAllocation(type, aCents, totalCents) {
  const t = normalizeAllocationType(type);
  if (t === ALLOC_CUSTOM) {
    const a = Math.round(aCents || 0);
    const lo = Math.min(0, Math.round(totalCents || 0));
    const hi = Math.max(0, Math.round(totalCents || 0));
    if (!Number.isFinite(a) || a < lo || a > hi) {
      throw new EndpointError('A custom split amount is out of range.', { code: 'INVALID_ALLOCATION' });
    }
  }
  return t;
}

/**
 * Load items and adjustments for a receipt, ordered by position.
 */
async function loadLines(receiptId) {
  const items = await db.select()
    .from(receiptItems)
    .where(eq(receiptItems.receiptId, receiptId))
    .orderBy(asc(receiptItems.position), asc(receiptItems.id))
    .all();
  const adjs = await db.select()
    .from(adjustments)
    .where(eq(adjustments.receiptId, receiptId))
    .orderBy(asc(adjustments.position), asc(adjustments.id))
    .all();
  return { items, adjs };
}

async function loadPreferences() {
  const rows = await db.select().from(allocationPreferences).all();
  return buildPreferenceMap(rows);
}

/**
 * Build the full, frontend-ready view of a receipt.
 */
export async function loadReceiptView(receiptId) {
  const receipt = await db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!receipt) throw new EndpointError('Receipt not found.', { code: 'NOT_FOUND' });

  const { items, adjs } = await loadLines(receiptId);
  const prefs = await loadPreferences();
  const { a, b } = await getOrderedParticipants();

  const itemsView = items.map((it) => {
    const suggestion = suggestAllocation(it.originalName, prefs);
    const split = splitCents(it.lineTotalCents, normalizeAllocationType(it.allocationType), it.allocationACents);
    return {
      id: it.id,
      position: it.position,
      originalName: it.originalName,
      englishName: it.englishName,
      quantity: it.quantity,
      unit: it.unit,
      unitPriceCents: it.unitPriceCents,
      lineTotalCents: it.lineTotalCents,
      confidence: it.confidence,
      isUncertain: Boolean(it.isUncertain),
      allocationType: it.allocationType,
      allocationACents: it.allocationACents,
      suggestedType: suggestion.type,
      suggestedACents: suggestion.aCents,
      splitA: split.a,
      splitB: split.b,
    };
  });

  const adjsView = adjs.map((x) => {
    const suggestion = suggestAllocation(x.label, prefs);
    const split = splitCents(x.amountCents, normalizeAllocationType(x.allocationType), x.allocationACents);
    return {
      id: x.id,
      position: x.position,
      kind: x.kind,
      label: x.label,
      amountCents: x.amountCents,
      allocationType: x.allocationType,
      allocationACents: x.allocationACents,
      suggestedType: suggestion.type,
      suggestedACents: suggestion.aCents,
      splitA: split.a,
      splitB: split.b,
    };
  });

  const { respA, respB, total } = receiptResponsibility(items, adjs);
  const calc = calculatedTotalCents(items, adjs);
  const disc = discrepancyCents(receipt.printedTotalCents, items, adjs);

  const participants = [a, b].filter(Boolean).map((p) => ({
    id: p.id, tgId: p.tgId, displayName: p.displayName, role: p.role,
  }));

  const confirmed = await db.select().from(receipts).where(eq(receipts.status, STATUS.CONFIRMED)).all();
  const confirmedWithLines = await Promise.all(confirmed.map(async (r) => ({
    payerId: r.payerId,
    items: (await loadLines(r.id)).items,
    adjustments: (await loadLines(r.id)).adjs,
  })));
  const settlements = await getSettlements();
  const balance = computeBalance(confirmedWithLines, settlements, a ? a.id : null);

  return {
    receipt: {
      id: receipt.id,
      store: receipt.store,
      date: receipt.purchaseDate,
      currency: receipt.currency,
      printedTotalCents: receipt.printedTotalCents,
      calculatedTotalCents: calc,
      discrepancyCents: disc,
      status: receipt.status,
      payerId: receipt.payerId,
      submittedById: receipt.submittedById,
      error: receipt.error,
      warnings: receipt.warnings || [],
    },
    items: itemsView,
    adjustments: adjsView,
    participants,
    totals: {
      respA,
      respB,
      total,
      itemsTotalCents: (items || []).reduce((s, it) => s + Math.round(it.lineTotalCents || 0), 0),
      adjustmentsTotalCents: (adjs || []).reduce((s, x) => s + Math.round(x.amountCents || 0), 0),
      calculatedTotalCents: calc,
      printedTotalCents: receipt.printedTotalCents,
      discrepancyCents: disc,
      reconciled: disc === 0,
    },
    balance,
  };
}

function assertEditable(status) {
  if (status === STATUS.CONFIRMED) {
    throw new EndpointError('This receipt is already confirmed and cannot be edited.', { code: 'ALREADY_CONFIRMED' });
  }
  if (status === STATUS.CANCELLED) {
    throw new EndpointError('This receipt has been cancelled.', { code: 'CANCELLED' });
  }
}

/**
 * Validate and persist a draft of a receipt (items, adjustments, metadata).
 * Returns the fresh view.
 */
export async function saveReceiptDraft(receiptId, draft) {
  const receipt = await db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!receipt) throw new EndpointError('Receipt not found.', { code: 'NOT_FOUND' });
  assertEditable(receipt.status);

  const store = typeof draft.store === 'string' ? draft.store.trim().slice(0, 200) : '';
  const date = typeof draft.date === 'string' ? draft.date.trim().slice(0, 32) : '';
  const currency = typeof draft.currency === 'string' && draft.currency ? draft.currency : receipt.currency;
  const payerId = draft.payerId != null ? Number(draft.payerId) : receipt.payerId;
  const printedTotalCents = draft.printedTotalCents != null
    ? Math.round(Number(draft.printedTotalCents))
    : receipt.printedTotalCents;

  // Validate and normalise incoming lines.
  const inItems = Array.isArray(draft.items) ? draft.items : [];
  const inAdjs = Array.isArray(draft.adjustments) ? draft.adjustments : [];

  const items = inItems.map((it, i) => {
    const lineTotalCents = Math.round(Number(it.lineTotalCents) || 0);
    const type = validateLineAllocation(it.allocationType, it.allocationACents, lineTotalCents);
    return {
      position: i,
      originalName: typeof it.originalName === 'string' ? it.originalName.trim().slice(0, 500) : '',
      englishName: typeof it.englishName === 'string' ? it.englishName.trim().slice(0, 500) : '',
      quantity: it.quantity == null || it.quantity === '' ? null : Number(it.quantity),
      unit: typeof it.unit === 'string' ? it.unit.trim().slice(0, 40) : '',
      unitPriceCents: it.unitPriceCents == null || it.unitPriceCents === '' ? null : Math.round(Number(it.unitPriceCents)),
      lineTotalCents,
      confidence: it.confidence == null || it.confidence === '' ? null : Math.max(0, Math.min(1, Number(it.confidence))),
      isUncertain: Boolean(it.isUncertain),
      allocationType: type,
      allocationACents: type === ALLOC_CUSTOM ? Math.round(Number(it.allocationACents) || 0) : null,
    };
  });

  const adjs = inAdjs.map((x, i) => {
    const amountCents = Math.round(Number(x.amountCents) || 0);
    const type = validateLineAllocation(x.allocationType, x.allocationACents, amountCents);
    return {
      position: i,
      kind: ['discount', 'pfand', 'refund', 'other'].includes(x.kind) ? x.kind : 'other',
      label: typeof x.label === 'string' ? x.label.trim().slice(0, 200) : '',
      amountCents,
      allocationType: type,
      allocationACents: type === ALLOC_CUSTOM ? Math.round(Number(x.allocationACents) || 0) : null,
    };
  });

  if (items.length === 0) {
    throw new EndpointError('A receipt must have at least one item.', { code: 'EMPTY_RECEIPT' });
  }

  const calc = calculatedTotalCents(items, adjs);
  const disc = printedTotalCents - calc;

  // Persist metadata.
  await db.update(receipts)
    .set({ store, purchaseDate: date, currency, payerId, printedTotalCents, calculatedTotalCents: calc, discrepancyCents: disc })
    .where(eq(receipts.id, receiptId))
    .run();

  // Replace children (parents first, then children — no foreign keys here).
  await db.delete(receiptItems).where(eq(receiptItems.receiptId, receiptId)).run();
  await db.delete(adjustments).where(eq(adjustments.receiptId, receiptId)).run();

  if (items.length) {
    const rows = items.map((it) => ({ receiptId, ...it, createdAt: Math.floor(Date.now() / 1000) }));
    await db.insert(receiptItems).values(rows).run();
  }
  if (adjs.length) {
    const rows = adjs.map((x) => ({ receiptId, ...x, createdAt: Math.floor(Date.now() / 1000) }));
    await db.insert(adjustments).values(rows).run();
  }

  return loadReceiptView(receiptId);
}

/**
 * Confirm a receipt (idempotent). Only a reconciled, fully-allocated receipt in
 * awaiting_review may be confirmed. Returns `{ balance, receiptId }`.
 */
export async function confirmReceipt(receiptId) {
  const receipt = await db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!receipt) throw new EndpointError('Receipt not found.', { code: 'NOT_FOUND' });

  // Idempotent: pressing Confirm again is a no-op.
  if (receipt.status === STATUS.CONFIRMED) {
    const { a } = await getOrderedParticipants();
    const balance = await currentBalance(a ? a.id : null);
    return { receiptId, balance, alreadyConfirmed: true };
  }
  assertEditable(receipt.status);

  const { items, adjs } = await loadLines(receiptId);
  if (items.length === 0) {
    throw new EndpointError('Cannot confirm an empty receipt.', { code: 'EMPTY_RECEIPT' });
  }

  // Reconcile: allocations must sum to the printed total.
  const disc = discrepancyCents(receipt.printedTotalCents, items, adjs);
  if (disc !== 0) {
    throw new EndpointError(
      `This receipt does not reconcile: the printed total differs from the line total by ${disc} cents. Fix the lines or add an adjustment.`,
      { code: 'DISCREPANCY', discrepancyCents: disc },
    );
  }

  // Validate every line's allocation.
  for (const it of items) validateLineAllocation(it.allocationType, it.allocationACents, it.lineTotalCents);
  for (const x of adjs) validateLineAllocation(x.allocationType, x.allocationACents, x.amountCents);

  // Duplicate prevention: refuse if another confirmed receipt shares the image
  // or semantic fingerprint.
  const fp = receipt.fingerprint || receipt.semanticFingerprint;
  if (fp) {
    const dupes = await db.select()
      .from(receipts)
      .where(and(
        eq(receipts.status, STATUS.CONFIRMED),
        ne(receipts.id, receiptId),
      ))
      .all();
    const clash = dupes.find((r) =>
      (r.fingerprint && r.fingerprint === receipt.fingerprint) ||
      (r.semanticFingerprint && r.semanticFingerprint === receipt.semanticFingerprint));
    if (clash) {
      throw new EndpointError('A confirmed receipt with the same fingerprint already exists.', { code: 'DUPLICATE' });
    }
  }

  // Persist allocation preferences.
  for (const it of items) {
    const pref = preferenceRowFromAllocation(it.originalName, it.allocationType, it.allocationACents);
    if (!pref) continue;
    await db.insert(allocationPreferences)
      .values({ ...pref, updatedAt: Math.floor(Date.now() / 1000) })
      .onConflictDoUpdate({
        target: allocationPreferences.key,
        set: {
          allocationType: pref.allocationType,
          allocationACents: pref.allocationACents,
          updatedAt: Math.floor(Date.now() / 1000),
        },
      })
      .run();
  }

  await db.update(receipts)
    .set({ status: STATUS.CONFIRMED, confirmedAt: Math.floor(Date.now() / 1000) })
    .where(eq(receipts.id, receiptId))
    .run();

  const { a } = await getOrderedParticipants();
  const balance = await currentBalance(a ? a.id : null);
  return { receiptId, balance, alreadyConfirmed: false };
}

export async function cancelReceipt(receiptId) {
  const receipt = await db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!receipt) throw new EndpointError('Receipt not found.', { code: 'NOT_FOUND' });
  if (receipt.status === STATUS.CONFIRMED) {
    throw new EndpointError('A confirmed receipt cannot be cancelled.', { code: 'ALREADY_CONFIRMED' });
  }
  await db.update(receipts).set({ status: STATUS.CANCELLED }).where(eq(receipts.id, receiptId)).run();
  return { receiptId, status: STATUS.CANCELLED };
}

/**
 * Permanently delete a receipt and its items/adjustments.
 *
 * Confirmed receipts are immutable for audit — they affect the balance and must
 * never be silently removed. To correct a confirmed entry, record a settlement.
 * Non-confirmed receipts (processing, awaiting_review, cancelled, failed) never
 * affect the balance, so deleting them is safe.
 */
export async function removeReceipt(receiptId) {
  const receipt = await db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!receipt) throw new EndpointError('Receipt not found.', { code: 'NOT_FOUND' });
  if (receipt.status === STATUS.CONFIRMED) {
    throw new EndpointError(
      'A confirmed receipt cannot be removed. Record a settlement instead to adjust the balance.',
      { code: 'ALREADY_CONFIRMED' },
    );
  }
  // Children first (no foreign keys — integrity enforced in app code).
  await db.delete(receiptItems).where(eq(receiptItems.receiptId, receiptId)).run();
  await db.delete(adjustments).where(eq(adjustments.receiptId, receiptId)).run();
  await db.delete(receipts).where(eq(receipts.id, receiptId)).run();
  return { receiptId, removed: true };
}

/**
 * Record an off-platform transfer (settlement) between the two participants.
 * Never touches historical receipts; the balance is recomputed on read.
 */
export async function createSettlement({ senderId, receiverId, amountCents, note, settledAt }) {
  const sender = Number(senderId);
  const receiver = Number(receiverId);
  const amount = Math.round(Number(amountCents) || 0);

  if (!Number.isFinite(sender) || !Number.isFinite(receiver) || sender === receiver) {
    throw new EndpointError('A settlement needs a distinct sender and receiver.', { code: 'INVALID_PARTIES' });
  }
  if (amount <= 0) {
    throw new EndpointError('The settlement amount must be positive.', { code: 'INVALID_AMOUNT' });
  }

  // Both parties must be active participants.
  const rows = await db.select().from(participants).all();
  const active = rows.filter((r) => r.isActive !== false);
  const ids = new Set(active.map((r) => r.id));
  if (!ids.has(sender) || !ids.has(receiver)) {
    throw new EndpointError('Both parties must be registered participants.', { code: 'INVALID_PARTIES' });
  }

  const ts = settledAt != null ? Math.round(Number(settledAt)) : Math.floor(Date.now() / 1000);
  const [row] = await db.insert(settlements).values({
    senderId: sender,
    receiverId: receiver,
    amountCents: amount,
    note: typeof note === 'string' ? note.trim().slice(0, 200) : null,
    settledAt: ts,
    createdAt: Math.floor(Date.now() / 1000),
  }).returning().run();

  const { a } = await getOrderedParticipants();
  const balance = await currentBalance(a ? a.id : null);
  return { settlement: row, balance };
}

/**
 * Recompute the household balance from confirmed receipts + settlements.
 */
export async function currentBalance(participantAId) {
  const confirmed = await db.select().from(receipts).where(eq(receipts.status, STATUS.CONFIRMED)).all();
  const confirmedWithLines = await Promise.all(confirmed.map(async (r) => {
    const lines = await loadLines(r.id);
    return { payerId: r.payerId, items: lines.items, adjustments: lines.adjs };
  }));
  const settlements = await getSettlements();
  return computeBalance(confirmedWithLines, settlements, participantAId);
}
