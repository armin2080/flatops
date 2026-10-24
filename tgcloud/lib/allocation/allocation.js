// allocation.js — how a single monetary line is split between the two
// participants. All amounts are integer cents and every split sums exactly to
// the original line amount (the "rounding never creates or destroys money"
// invariant).

export const ALLOC_SHARED = 'shared';
export const ALLOC_A = 'person_a';
export const ALLOC_B = 'person_b';
export const ALLOC_CUSTOM = 'custom';

export const ALLOC_TYPES = [ALLOC_SHARED, ALLOC_A, ALLOC_B, ALLOC_CUSTOM];

/**
 * Split `totalCents` into `{ a, b }` where a + b === totalCents exactly.
 *
 * - shared: Person A receives floor(total/2); Person B receives the remainder.
 *   On an odd-cent amount Person B gets the extra cent. Deterministic and
 *   documented (see docs/financial-model.md).
 * - person_a / person_b: 100% to one side.
 * - custom: `allocACents` is clamped to the valid range so a + b === total.
 *
 * Handles negative amounts (discounts) correctly.
 */
export function splitCents(totalCents, type, allocACents = null) {
  const total = Math.round(totalCents || 0);

  switch (type) {
    case ALLOC_A:
      return { a: total, b: 0 };
    case ALLOC_B:
      return { a: 0, b: total };
    case ALLOC_SHARED: {
      const a = Math.floor(total / 2);
      return { a, b: total - a };
    }
    case ALLOC_CUSTOM: {
      let a = Math.round(allocACents || 0);
      const lo = Math.min(0, total);
      const hi = Math.max(0, total);
      a = Math.max(lo, Math.min(hi, a));
      return { a, b: total - a };
    }
    default:
      throw new Error(`Unknown allocation type: ${type}`);
  }
}

/**
 * Coerce an arbitrary string to a valid allocation type (defaults to shared).
 */
export function normalizeAllocationType(type) {
  return ALLOC_TYPES.includes(type) ? type : ALLOC_SHARED;
}

/**
 * Validate a user-supplied allocation against a line total. Returns a normalised
 * allocation or null when invalid.
 */
export function validateAllocation(type, allocACents, totalCents) {
  const t = normalizeAllocationType(type);
  if (t === ALLOC_CUSTOM) {
    const a = Math.round(allocACents || 0);
    const lo = Math.min(0, Math.round(totalCents || 0));
    const hi = Math.max(0, Math.round(totalCents || 0));
    if (!Number.isFinite(a) || a < lo || a > hi) return null;
    return { type: t, aCents: a };
  }
  return { type: t, aCents: null };
}

/**
 * Human-readable labels for allocation types.
 */
export function allocationLabel(type) {
  switch (type) {
    case ALLOC_A:
      return 'Person A';
    case ALLOC_B:
      return 'Person B';
    case ALLOC_CUSTOM:
      return 'Custom split';
    case ALLOC_SHARED:
    default:
      return 'Shared';
  }
}
