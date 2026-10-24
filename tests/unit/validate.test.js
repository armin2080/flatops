import { describe, it, expect } from 'vitest';
import { normalizeExtraction, inferAdjustmentKind } from '../../tgcloud/lib/receipts/validate.js';
import { milkTeaFixture, pfandDiscountFixture } from '../fixtures/german-receipts.js';

describe('normalizeExtraction', () => {
  it('preserves original German names and keeps English translations separate', () => {
    const r = normalizeExtraction(milkTeaFixture);
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(4);
    expect(r.items[0].originalName).toBe('Vollmilch 3,5%');
    expect(r.items[0].englishName).toBe('Whole milk 3.5%');
    expect(r.items[0].lineTotalCents).toBe(109);
  });

  it('parses German money into cents', () => {
    const r = normalizeExtraction(milkTeaFixture);
    expect(r.totalCents).toBe(966);
    expect(r.items.map((i) => i.lineTotalCents)).toEqual([109, 249, 229, 179]);
  });

  it('classifies Pfand and discounts as adjustments, not items', () => {
    const r = normalizeExtraction(pfandDiscountFixture);
    expect(r.items).toHaveLength(3);
    expect(r.adjustments).toHaveLength(2);
    const kinds = r.adjustments.map((a) => a.kind);
    expect(kinds).toContain('pfand');
    expect(kinds).toContain('discount');
  });

  it('marks missing-price lines as uncertain and warns', () => {
    const r = normalizeExtraction({
      store: 'X', total: '1,00',
      items: [{ original: 'Mystery', english: '', line_total: null }],
    });
    expect(r.items[0].isUncertain).toBe(true);
    expect(r.items[0].lineTotalCents).toBe(0);
    expect(r.warnings.some((w) => w.includes('price'))).toBe(true);
  });

  it('distinguishes unit price from line total', () => {
    const r = normalizeExtraction({
      store: 'X', total: '2,00',
      items: [{ original: 'Two of X', english: 'X', quantity: '2', unit: 'Stück', unit_price: '1,00', line_total: '2,00' }],
    });
    expect(r.items[0].unitPriceCents).toBe(100);
    expect(r.items[0].lineTotalCents).toBe(200);
  });

  it('rejects non-object input', () => {
    const r = normalizeExtraction(null);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('inferAdjustmentKind', () => {
  it('infers from words', () => {
    expect(inferAdjustmentKind(null, 'Flaschenpfand', 25)).toBe('pfand');
    expect(inferAdjustmentKind(null, 'Rabatt', -100)).toBe('discount');
  });
  it('falls back by sign', () => {
    expect(inferAdjustmentKind(null, 'Unknown', -50)).toBe('discount');
    expect(inferAdjustmentKind(null, 'Unknown', 50)).toBe('other');
  });
});
