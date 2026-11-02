import { describe, it, expect } from 'vitest';
import { categorizeItem, normalizeCategory, categoryList, CATEGORIES } from '../../tgcloud/lib/analytics/categories.js';

describe('normalizeCategory', () => {
  it('accepts valid ids and labels', () => {
    expect(normalizeCategory('dairy')).toBe('dairy');
    expect(normalizeCategory('Dairy & Eggs')).toBe('dairy');
    expect(normalizeCategory('Groceries')).toBe('groceries');
  });

  it('rejects unknown values', () => {
    expect(normalizeCategory('bogus')).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
    expect(normalizeCategory(42)).toBeNull();
  });
});

describe('categorizeItem', () => {
  it('classifies common German groceries', () => {
    expect(categorizeItem('Vollmilch 3,5%', 'Whole milk')).toBe('dairy');
    expect(categorizeItem('Gouda jung', 'Young gouda')).toBe('dairy');
    expect(categorizeItem('Bananen', 'Bananas')).toBe('produce');
    expect(categorizeItem('Schwarzer Tee', 'Black tea')).toBe('beverages');
    expect(categorizeItem('Brot', 'Bread')).toBe('bakery');
    expect(categorizeItem('Hähnchenbrust', 'Chicken breast')).toBe('meat');
    expect(categorizeItem('Toilettenpapier', 'Toilet paper')).toBe('household');
    expect(categorizeItem('Spülmittel', 'Dish soap')).toBe('cleaning');
    expect(categorizeItem('Zahnpasta', 'Toothpaste')).toBe('personal_care');
  });

  it('falls back to other for unknown items', () => {
    expect(categorizeItem('Geheimnisprodukt', '')).toBe('other');
    expect(categorizeItem('', '')).toBe('other');
  });

  it('always returns a valid category id', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id));
    for (const item of ['Milch', 'Apfel', 'Wasser', 'Chips', 'Batterie', 'Xyzzy']) {
      expect(ids.has(categorizeItem(item, ''))).toBe(true);
    }
  });
});

describe('categoryList', () => {
  it('returns id/label/emoji triples', () => {
    const list = categoryList();
    expect(list.length).toBe(CATEGORIES.length);
    expect(list[0]).toHaveProperty('id');
    expect(list[0]).toHaveProperty('label');
    expect(list[0]).toHaveProperty('emoji');
  });
});
