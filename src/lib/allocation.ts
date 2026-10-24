// Client-side mirror of the backend allocation math, used only for the live
// preview. The backend re-validates everything on save/confirm.

import type { AllocationType } from './types';

export const ALLOC_SHARED: AllocationType = 'shared';
export const ALLOC_A: AllocationType = 'person_a';
export const ALLOC_B: AllocationType = 'person_b';
export const ALLOC_CUSTOM: AllocationType = 'custom';

export function splitCents(totalCents: number, type: string, allocACents: number | null = null) {
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
      return { a: 0, b: total };
  }
}

export function allocationLabel(type: string, nameA = 'Person A', nameB = 'Person B'): string {
  switch (type) {
    case ALLOC_A:
      return nameA;
    case ALLOC_B:
      return nameB;
    case ALLOC_CUSTOM:
      return 'Custom';
    case ALLOC_SHARED:
    default:
      return 'Shared';
  }
}
