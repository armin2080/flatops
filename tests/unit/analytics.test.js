import { describe, it, expect } from 'vitest';
import { computeMonthlyAnalytics, monthOf } from '../../tgcloud/lib/analytics/analytics.js';

describe('monthOf', () => {
  it('extracts YYYY-MM from a date', () => {
    expect(monthOf('2026-10-22')).toBe('2026-10');
    expect(monthOf('2026-11')).toBe('2026-11');
    expect(monthOf(null)).toBeNull();
    expect(monthOf('garbage')).toBeNull();
  });
});

describe('computeMonthlyAnalytics', () => {
  const receipts = [
    {
      purchaseDate: '2026-10-10',
      items: [
        { lineTotalCents: 1000, category: 'dairy', allocationType: 'shared', allocationACents: null },
        { lineTotalCents: 500, category: 'produce', allocationType: 'person_a', allocationACents: null },
        { lineTotalCents: 300, category: 'snacks', allocationType: 'person_b', allocationACents: null },
      ],
      adjustments: [{ amountCents: -200, allocationType: 'shared', allocationACents: null }],
    },
    {
      purchaseDate: '2026-11-05',
      items: [
        { lineTotalCents: 2000, category: 'beverages', allocationType: 'shared', allocationACents: null },
      ],
      adjustments: [],
    },
  ];

  it('filters by month', () => {
    const oct = computeMonthlyAnalytics(receipts, '2026-10');
    expect(oct.totalCents).toBe(1000 + 500 + 300 - 200); // 1600
    const nov = computeMonthlyAnalytics(receipts, '2026-11');
    expect(nov.totalCents).toBe(2000);
  });

  it('aggregates all time when month is null or all', () => {
    expect(computeMonthlyAnalytics(receipts, null).totalCents).toBe(3600);
    expect(computeMonthlyAnalytics(receipts, 'all').totalCents).toBe(3600);
  });

  it('splits shares deterministically and totals reconcile', () => {
    const oct = computeMonthlyAnalytics(receipts, '2026-10');
    // dairy 1000 shared -> 500/500; produce 500 A -> 500/0; snacks 300 B -> 0/300; -200 shared -> -100/-100
    expect(oct.aShareCents).toBe(500 + 500 + 0 - 100); // 900
    expect(oct.bShareCents).toBe(500 + 0 + 300 - 100); // 700
    expect(oct.aShareCents + oct.bShareCents).toBe(oct.totalCents);
  });

  it('folds adjustments into "other"', () => {
    const oct = computeMonthlyAnalytics(receipts, '2026-10');
    expect(oct.byCategory['other']).toBe(-200);
  });

  it('handles empty input', () => {
    const empty = computeMonthlyAnalytics([], null);
    expect(empty.totalCents).toBe(0);
    expect(empty.aShareCents).toBe(0);
    expect(Object.keys(empty.byCategory)).toHaveLength(0);
  });
});
