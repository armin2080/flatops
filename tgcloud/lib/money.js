// money.js — integer-cent monetary helpers.
//
// FlatOps represents every amount as an integer number of cents. Floating-point
// is never used for monetary totals. This module centralises parsing of the
// German/European decimal formats found on receipts ("2,49 €", "1.234,56")
// and formatting for display.

/**
 * Parse a monetary value into integer cents.
 *
 * Accepts:
 *   - numbers (2.49 -> 249)
 *   - strings in German or English formats: "2,49", "2.49", "2,49 €", "€ 2,49",
 *     "1.234,56", "1,234.56", "-1,00", "0,25"
 *
 * Returns `null` when the value cannot be interpreted as money.
 */
export function parseMoneyToCents(input) {
  if (input === null || input === undefined || input === '') return null;

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }

  if (typeof input !== 'string') return null;

  let s = input.trim();
  if (s === '' || s === '-' || s === '+') return null;

  let negative = false;
  if (s[0] === '-') {
    negative = true;
    s = s.slice(1);
  } else if (s[0] === '+') {
    s = s.slice(1);
  }

  // Strip currency words/symbols and any whitespace.
  s = s
    .replace(/\s+/g, '')
    .replace(/€/g, '')
    .replace(/\b(?:EUR|eur|Euro|euro|CHF|USD|GBP)\b/g, '');

  if (s === '') return null;
  if (!/^[0-9.,]+$/.test(s)) return null;

  const commaCount = (s.match(/,/g) || []).length;
  const dotCount = (s.match(/\./g) || []).length;

  let integerPart;
  let fracPart;

  if (commaCount === 0 && dotCount === 0) {
    integerPart = s;
    fracPart = '';
  } else if (commaCount >= 1 && dotCount >= 1) {
    // Both separators present: the last one is the decimal separator, the other
    // is a thousands separator.
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const decimalIdx = Math.max(lastComma, lastDot);
    const thousandsChar = decimalIdx === lastComma ? '.' : ',';
    integerPart = s.slice(0, decimalIdx).split(thousandsChar).join('');
    fracPart = s.slice(decimalIdx + 1);
  } else if (commaCount >= 1) {
    const lastComma = s.lastIndexOf(',');
    const fracLen = s.length - lastComma - 1;
    if (commaCount === 1 && fracLen === 3) {
      // "1,234" -> 1234 (thousands), not 1.234
      integerPart = s.slice(0, lastComma);
      fracPart = '';
    } else {
      integerPart = s.slice(0, lastComma).split(',').join('');
      fracPart = s.slice(lastComma + 1);
    }
  } else {
    // dotCount >= 1
    const lastDot = s.lastIndexOf('.');
    const fracLen = s.length - lastDot - 1;
    if (dotCount === 1 && fracLen === 3) {
      // "1.234" -> 1234 (thousands)
      integerPart = s.slice(0, lastDot);
      fracPart = '';
    } else {
      integerPart = s.slice(0, lastDot).split('.').join('');
      fracPart = s.slice(lastDot + 1);
    }
  }

  if (integerPart === '') integerPart = '0';

  let frac = fracPart;
  if (frac.length === 0) {
    frac = '00';
  } else if (frac.length === 1) {
    frac = `${frac}0`;
  } else if (frac.length > 2) {
    // More than two decimals — round half-up to the nearest cent.
    const head = frac.slice(0, 2);
    const next = parseInt(frac.slice(2, 3), 10);
    frac = next >= 5 ? String(parseInt(head, 10) + 1).padStart(2, '0') : head;
  }

  const intVal = parseInt(integerPart, 10);
  const fracVal = parseInt(frac, 10);
  if (!Number.isFinite(intVal) || !Number.isFinite(fracVal)) return null;

  let cents = intVal * 100 + fracVal;
  if (negative) cents = -cents;
  return cents;
}

/**
 * Clamp a value into integer cents safely (round half-up, no NaN).
 */
export function toCents(value) {
  if (value === null || value === undefined) return 0;
  const n = Math.round(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

const CURRENCY_SYMBOLS = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };

/**
 * Format cents as a readable money string, e.g. "€31.60".
 * Negative amounts are rendered with a leading minus sign.
 */
export function formatCents(cents, currency = 'EUR') {
  const v = toCents(cents);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const major = Math.floor(abs / 100);
  const minor = String(abs % 100).padStart(2, '0');
  const symbol = CURRENCY_SYMBOLS[currency] || currency || '';
  return `${sign}${symbol}${major}.${minor}`;
}

/**
 * Format cents in German convention, e.g. "31,60 €".
 */
export function formatCentsGerman(cents) {
  const v = toCents(cents);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const major = Math.floor(abs / 100);
  const minor = String(abs % 100).padStart(2, '0');
  return `${sign}${major},${minor} €`;
}

/**
 * Normalise a currency code (case-insensitive). Unknown values fall back to EUR.
 */
export function normalizeCurrency(input) {
  if (typeof input !== 'string') return 'EUR';
  const c = input.trim().toUpperCase();
  if (c === 'EURO') return 'EUR';
  if (/^[A-Z]{3}$/.test(c)) return c;
  return 'EUR';
}
