// preferences.js — remembering previous allocation decisions so the user is not
// asked the same thing repeatedly. A "key" is derived from the original German
// product name; the most recent allocation for that key is suggested next time.

import { ALLOC_SHARED, normalizeAllocationType } from './allocation.js';

/**
 * Normalise a product name into a stable preference key.
 */
export function preferenceKey(originalName) {
  return String(originalName ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Given a map of `{ key: { type, aCents } }`, return a suggested allocation for
 * a product. Falls back to shared when there is no prior decision.
 */
export function suggestAllocation(originalName, prefs = {}) {
  const key = preferenceKey(originalName);
  const p = key ? prefs[key] : null;
  if (!p) return { type: ALLOC_SHARED, aCents: null };
  return {
    type: normalizeAllocationType(p.type),
    aCents: typeof p.aCents === 'number' ? p.aCents : null,
  };
}

/**
 * Build a preferences map from database rows shaped
 * `{ key, allocationType, allocationACents }`.
 */
export function buildPreferenceMap(rows = []) {
  const map = {};
  for (const r of rows) {
    if (!r || !r.key) continue;
    map[r.key] = { type: r.allocationType, aCents: r.allocationACents ?? null };
  }
  return map;
}

/**
 * Given the final (confirmed) allocation of an item, derive the preference row
 * to persist so it can be suggested later.
 */
export function preferenceRowFromAllocation(originalName, type, aCents) {
  const key = preferenceKey(originalName);
  if (!key) return null;
  const t = normalizeAllocationType(type);
  return {
    key,
    allocationType: t,
    allocationACents: t === 'custom' ? aCents : null,
  };
}
