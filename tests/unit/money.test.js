import { describe, it, expect } from 'vitest';
import { parseMoneyToCents, formatCents, formatCentsGerman, normalizeCurrency, toCents } from '../../tgcloud/lib/money.js';

describe('parseMoneyToCents', () => {
  it('parses German decimal comma', () => {
    expect(parseMoneyToCents('2,49 €')).toBe(249);
    expect(parseMoneyToCents('31,60')).toBe(3160);
    expect(parseMoneyToCents('0,25')).toBe(25);
    expect(parseMoneyToCents('€ 2,49')).toBe(249);
  });

  it('parses English decimal point', () => {
    expect(parseMoneyToCents('2.49')).toBe(249);
    expect(parseMoneyToCents('31.60')).toBe(3160);
  });

  it('parses thousands separators', () => {
    expect(parseMoneyToCents('1.234,56')).toBe(123456);
    expect(parseMoneyToCents('1,234.56')).toBe(123456);
  });

  it('parses negative amounts', () => {
    expect(parseMoneyToCents('-1,00')).toBe(-100);
    expect(parseMoneyToCents('-0,25')).toBe(-25);
  });

  it('parses plain integers', () => {
    expect(parseMoneyToCents('20')).toBe(2000);
    expect(parseMoneyToCents('3')).toBe(300);
  });

  it('parses numbers', () => {
    expect(parseMoneyToCents(2.49)).toBe(249);
    expect(parseMoneyToCents(31.6)).toBe(3160);
  });

  it('returns null for garbage', () => {
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('abc')).toBeNull();
    expect(parseMoneyToCents(null)).toBeNull();
    expect(parseMoneyToCents(NaN)).toBeNull();
  });
});

describe('formatCents', () => {
  it('formats euros', () => {
    expect(formatCents(249)).toBe('€2.49');
    expect(formatCents(3160)).toBe('€31.60');
    expect(formatCents(-100)).toBe('-€1.00');
    expect(formatCents(0)).toBe('€0.00');
  });

  it('formats German style', () => {
    expect(formatCentsGerman(249)).toBe('2,49 €');
    expect(formatCentsGerman(3160)).toBe('31,60 €');
  });
});

describe('normalizeCurrency', () => {
  it('normalises currency codes', () => {
    expect(normalizeCurrency('eur')).toBe('EUR');
    expect(normalizeCurrency('EURO')).toBe('EUR');
    expect(normalizeCurrency('CHF')).toBe('CHF');
    expect(normalizeCurrency(null)).toBe('EUR');
  });
});

describe('toCents', () => {
  it('clamps to finite integer', () => {
    expect(toCents(2.499)).toBe(2);
    expect(toCents(null)).toBe(0);
    expect(toCents(Infinity)).toBe(0);
  });
});
