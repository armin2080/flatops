// base64.js — encode bytes to a base64 string without relying on Buffer/btoa,
// which are not guaranteed in the Telegram Serverless V8 isolate.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const len = b.length;
  let out = '';
  let i = 0;
  while (i < len) {
    const b0 = b[i++];
    const has1 = i < len;
    const b1 = has1 ? b[i++] : 0;
    const has2 = i < len;
    const b2 = has2 ? b[i++] : 0;

    const n = (b0 << 16) | (b1 << 8) | b2;
    out += ALPHABET[(n >> 18) & 63];
    out += ALPHABET[(n >> 12) & 63];
    out += has1 ? ALPHABET[(n >> 6) & 63] : '=';
    out += has2 ? ALPHABET[n & 63] : '=';
  }
  return out;
}
