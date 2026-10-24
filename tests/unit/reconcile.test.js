import { describe, it, expect } from 'vitest';
import { calculatedTotalCents, discrepancyCents, reconcile } from '../../tgcloud/lib/receipts/reconcile.js';

const items = [
  { lineTotalCents: 109 },
  { lineTotalCents: 249 },
  { lineTotalCents: 229 },
  { lineTotalCents: 179 },
];
const adjustments = [{ amountCents: 300 }, { amountCents: -100 }];

describe('calculatedTotalCents', () => {
  it('sums items and adjustments', () => {
    expect(calculatedTotalCents(items, [])).toBe(766);
    expect(calculatedTotalCents(items, adjustments)).toBe(966);
  });
});

describe('discrepancyCents', () => {
  it('computes printed minus calculated', () => {
    expect(discrepancyCents(966, items, adjustments)).toBe(0);
    expect(discrepancyCents(1000, items, adjustments)).toBe(34);
    expect(discrepancyCents(900, items, adjustments)).toBe(-66);
  });
});

describe('reconcile', () => {
  it('reports reconciled when totals match', () => {
    const r = reconcile(966, items, adjustments);
    expect(r.reconciled).toBe(true);
    expect(r.discrepancyCents).toBe(0);
  });

  it('reports discrepancy when totals differ', () => {
    const r = reconcile(1000, items, adjustments);
    expect(r.reconciled).toBe(false);
    expect(r.discrepancyCents).toBe(34);
  });
});
