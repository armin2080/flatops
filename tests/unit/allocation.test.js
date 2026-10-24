import { describe, it, expect } from 'vitest';
import {
  splitCents, normalizeAllocationType, validateAllocation, allocationLabel,
  ALLOC_SHARED, ALLOC_A, ALLOC_B, ALLOC_CUSTOM,
} from '../../tgcloud/lib/allocation/allocation.js';

describe('splitCents', () => {
  it('splits shared evenly', () => {
    expect(splitCents(200, ALLOC_SHARED)).toEqual({ a: 100, b: 100 });
  });

  it('splits shared odd cents deterministically (A floor, B remainder)', () => {
    expect(splitCents(229, ALLOC_SHARED)).toEqual({ a: 114, b: 115 });
    expect(splitCents(229, ALLOC_SHARED).a + splitCents(229, ALLOC_SHARED).b).toBe(229);
  });

  it('assigns fully to A or B', () => {
    expect(splitCents(500, ALLOC_A)).toEqual({ a: 500, b: 0 });
    expect(splitCents(500, ALLOC_B)).toEqual({ a: 0, b: 500 });
  });

  it('splits custom amounts', () => {
    expect(splitCents(1000, ALLOC_CUSTOM, 700)).toEqual({ a: 700, b: 300 });
  });

  it('clamps custom split into range', () => {
    expect(splitCents(1000, ALLOC_CUSTOM, 1500)).toEqual({ a: 1000, b: 0 });
    expect(splitCents(1000, ALLOC_CUSTOM, -50)).toEqual({ a: 0, b: 1000 });
  });

  it('handles negative (discount) lines', () => {
    expect(splitCents(-100, ALLOC_SHARED)).toEqual({ a: -50, b: -50 });
    expect(splitCents(-101, ALLOC_SHARED).a + splitCents(-101, ALLOC_SHARED).b).toBe(-101);
  });

  it('always sums exactly to the original amount', () => {
    for (const cents of [0, 1, 99, 100, 101, 229, 999, 1000, 12345, -100, -101]) {
      const s = splitCents(cents, ALLOC_SHARED);
      expect(s.a + s.b).toBe(cents);
    }
  });
});

describe('normalizeAllocationType', () => {
  it('defaults unknown types to shared', () => {
    expect(normalizeAllocationType('bogus')).toBe(ALLOC_SHARED);
    expect(normalizeAllocationType(null)).toBe(ALLOC_SHARED);
    expect(normalizeAllocationType(ALLOC_A)).toBe(ALLOC_A);
  });
});

describe('validateAllocation', () => {
  it('accepts valid custom splits', () => {
    expect(validateAllocation(ALLOC_CUSTOM, 700, 1000)).toEqual({ type: ALLOC_CUSTOM, aCents: 700 });
  });

  it('rejects out-of-range custom splits', () => {
    expect(validateAllocation(ALLOC_CUSTOM, 1500, 1000)).toBeNull();
    expect(validateAllocation(ALLOC_CUSTOM, -1, 1000)).toBeNull();
  });

  it('accepts simple types', () => {
    expect(validateAllocation(ALLOC_SHARED, null, 1000)).toEqual({ type: ALLOC_SHARED, aCents: null });
  });
});

describe('allocationLabel', () => {
  it('labels types', () => {
    expect(allocationLabel(ALLOC_SHARED)).toBe('Shared');
    expect(allocationLabel(ALLOC_A)).toBe('Person A');
    expect(allocationLabel(ALLOC_CUSTOM)).toBe('Custom split');
  });
});
