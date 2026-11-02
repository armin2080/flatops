// analytics.js — monthly spending aggregation (pure, no `sdk`).
//
// Groups confirmed receipt items by category and by each participant's share.
// Adjustments (discounts/pfand) are folded into "other" so category totals
// reconcile with the household total.

import { splitCents, normalizeAllocationType } from '../allocation/allocation.js';

/**
 * Extract a YYYY-MM month from a receipt date string, or null.
 */
export function monthOf(dateString) {
  if (typeof dateString !== 'string') return null;
  const m = dateString.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Compute monthly analytics.
 *
 * @param {Array} receipts confirmed receipts, each
 *   `{ purchaseDate, items:[{lineTotalCents, category, allocationType, allocationACents}], adjustments:[{amountCents, allocationType, allocationACents}] }`.
 * @param {string|null} month 'YYYY-MM' or null for all time.
 */
export function computeMonthlyAnalytics(receipts = [], month = null) {
  const byCategory = {};       // categoryId -> household net cents
  const aShareByCategory = {}; // categoryId -> Person A share cents
  const bShareByCategory = {}; // categoryId -> Person B share cents
  let totalCents = 0;
  let aShareCents = 0;
  let bShareCents = 0;

  const add = (cents, category, allocationType, allocationACents) => {
    const c = Math.round(cents || 0);
    const cat = category || 'other';
    const split = splitCents(c, normalizeAllocationType(allocationType), allocationACents);
    byCategory[cat] = (byCategory[cat] || 0) + c;
    aShareByCategory[cat] = (aShareByCategory[cat] || 0) + split.a;
    bShareByCategory[cat] = (bShareByCategory[cat] || 0) + split.b;
    totalCents += c;
    aShareCents += split.a;
    bShareCents += split.b;
  };

  for (const r of receipts || []) {
    if (month && month !== 'all' && monthOf(r.purchaseDate) !== month) continue;
    for (const it of r.items || []) {
      add(it.lineTotalCents, it.category, it.allocationType, it.allocationACents);
    }
    for (const adj of r.adjustments || []) {
      add(adj.amountCents, 'other', adj.allocationType, adj.allocationACents);
    }
  }

  return {
    totalCents,
    aShareCents,
    bShareCents,
    byCategory,
    aShareByCategory,
    bShareByCategory,
  };
}
