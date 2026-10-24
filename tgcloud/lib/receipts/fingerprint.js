// fingerprint.js — deterministic content hashing for duplicate-receipt
// detection. Pure JavaScript (no Buffer, no crypto module) so it runs in the
// Telegram Serverless V8 isolate.

function fnv1a32(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function djb2(bytes) {
  let h = 5381;
  for (let i = 0; i < bytes.length; i++) {
    h = ((h << 5) + h + bytes[i]) >>> 0;
  }
  return h >>> 0;
}

/**
 * Hash a Uint8Array (or Array) into a 64-bit hex string combining two
 * independent 32-bit hashes. Good enough for "likely duplicate" detection,
 * which is always cross-checked against store/date/total.
 */
export function hashBytes(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const a = fnv1a32(b).toString(16).padStart(8, '0');
  const c = djb2(b).toString(16).padStart(8, '0');
  return `${a}${c}`;
}

/**
 * A semantic fingerprint independent of image bytes: store + date + total +
 * first few line totals. Used to catch the same receipt re-photographed.
 */
export function semanticFingerprint({ store, date, totalCents, itemTotals = [] }) {
  const head = (itemTotals || []).slice(0, 6).join(':');
  return [store || '', date || '', totalCents, head].join('|').toLowerCase();
}
