// ledger.js — the shared financial balance.
//
// Pure logic: computes responsibilities from allocated lines and derives the
// running balance from confirmed receipts plus recorded settlements.
//
// SIGN CONVENTION (single source of truth):
//   netBalanceCents > 0  =>  Person B owes Person A that amount.
//   netBalanceCents < 0  =>  Person A owes Person B that amount.
// Person A is the participant with the lower internal id; Person B the higher.

import { splitCents, normalizeAllocationType, ALLOC_SHARED } from '../allocation/allocation.js';
import { toLines } from '../receipts/reconcile.js';

/**
 * Compute each participant's responsibility for a receipt from its lines.
 * Returns `{ respA, respB, total }` with respA + respB === total exactly.
 */
export function receiptResponsibility(items = [], adjustments = []) {
  let respA = 0;
  let total = 0;
  for (const line of toLines(items, adjustments)) {
    const cents = Math.round(line.cents || 0);
    const split = splitCents(cents, normalizeAllocationType(line.type), line.aCents);
    respA += split.a;
    total += cents;
  }
  return { respA, respB: total - respA, total };
}

/**
 * Total amount allocated as "shared" across the receipt.
 */
export function sharedAmount(items = [], adjustments = []) {
  let sum = 0;
  for (const line of toLines(items, adjustments)) {
    if (normalizeAllocationType(line.type) === ALLOC_SHARED) {
      sum += Math.round(line.cents || 0);
    }
  }
  return sum;
}

/**
 * Compute the household balance.
 *
 * @param {Array} receipts confirmed receipts, each
 *   `{ payerId, items, adjustments }`.
 * @param {Array} settlements `{ senderId, amountCents }`.
 * @param {number} participantAId internal id of Person A.
 * @returns {{
 *   netBalanceCents: number,
 *   aOwesBCents: number,
 *   bOwesACents: number,
 *   spentACents: number,
 *   spentBCents: number,
 *   sharedTotalCents: number,
 * }}
 */
export function computeBalance(receipts = [], settlements = [], participantAId) {
  let net = 0; // + => B owes A
  let spentA = 0;
  let spentB = 0;
  let sharedTotal = 0;

  for (const r of receipts || []) {
    const { respA, total } = receiptResponsibility(r.items, r.adjustments);
    const payerIsA = r.payerId === participantAId;
    if (payerIsA) {
      // A paid the whole bill; B's responsibility is what B owes A.
      net += total - respA;
      spentA += total;
    } else {
      // B paid; A's responsibility is what A owes B.
      net -= respA;
      spentB += total;
    }
    sharedTotal += sharedAmount(r.items, r.adjustments);
  }

  for (const s of settlements || []) {
    const senderIsA = s.senderId === participantAId;
    // A paying B reduces A's debt to B (net += amount).
    // B paying A reduces B's debt to A (net -= amount).
    net += senderIsA ? Math.round(s.amountCents || 0) : -Math.round(s.amountCents || 0);
  }

  return {
    netBalanceCents: net,
    aOwesBCents: net < 0 ? -net : 0,
    bOwesACents: net > 0 ? net : 0,
    spentACents: spentA,
    spentBCents: spentB,
    sharedTotalCents: sharedTotal,
  };
}

/**
 * A human-readable balance summary line, e.g.
 * "FlatOps balance: Bob owes Ann €14.00" or "You're all square 🎉".
 */
export function describeBalance(balance, nameA = 'Person A', nameB = 'Person B') {
  const net = balance.netBalanceCents;
  if (net === 0) return 'You are all settled up 🎉';
  if (net > 0) {
    return `${nameB} owes ${nameA} ${formatCentsAbs(net)}`;
  }
  return `${nameA} owes ${nameB} ${formatCentsAbs(-net)}`;
}

function formatCentsAbs(cents) {
  const abs = Math.abs(cents);
  const major = Math.floor(abs / 100);
  const minor = String(abs % 100).padStart(2, '0');
  return `€${major}.${minor}`;
}
