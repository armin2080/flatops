// reconcile.js — reconciling extracted line totals against the printed grand
// total on the receipt.

/**
 * Reduce a set of lines (each `{ cents }`) to a sum in integer cents.
 */
export function sumLineTotals(lines = []) {
  return lines.reduce((sum, l) => sum + Math.round((l && l.cents) || 0), 0);
}

/**
 * Map receipt items and adjustments into a common line shape.
 */
export function toLines(items = [], adjustments = []) {
  const lines = [];
  for (const it of items || []) {
    lines.push({ cents: it.lineTotalCents, type: it.allocationType, aCents: it.allocationACents });
  }
  for (const ad of adjustments || []) {
    lines.push({ cents: ad.amountCents, type: ad.allocationType, aCents: ad.allocationACents });
  }
  return lines;
}

/**
 * The calculated total = sum of all item line totals + sum of all adjustments
 * (discounts are negative, Pfand/charges are positive).
 */
export function calculatedTotalCents(items = [], adjustments = []) {
  const itemSum = (items || []).reduce((s, it) => s + Math.round(it.lineTotalCents || 0), 0);
  const adjSum = (adjustments || []).reduce((s, a) => s + Math.round(a.amountCents || 0), 0);
  return itemSum + adjSum;
}

/**
 * Difference between the printed total and the calculated total. A non-zero
 * value means the receipt does not reconcile and must be corrected or explicitly
 * reconciled before confirmation.
 */
export function discrepancyCents(printedTotalCents, items = [], adjustments = []) {
  return Math.round(printedTotalCents || 0) - calculatedTotalCents(items, adjustments);
}

/**
 * Full reconciliation result.
 */
export function reconcile(printedTotalCents, items = [], adjustments = []) {
  const printedTotal = Math.round(printedTotalCents || 0);
  const calculated = calculatedTotalCents(items, adjustments);
  const diff = printedTotal - calculated;
  return {
    printedTotalCents: printedTotal,
    calculatedTotalCents: calculated,
    discrepancyCents: diff,
    reconciled: diff === 0,
  };
}
