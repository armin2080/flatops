// Money formatting for the Mini App (integer cents everywhere).

export function formatCents(cents: number, currency = 'EUR'): string {
  const v = Math.round(cents);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const major = Math.floor(abs / 100);
  const minor = String(abs % 100).padStart(2, '0');
  const symbol = currency === 'EUR' ? '€' : currency;
  return `${sign}${symbol}${major}.${minor}`;
}

export function formatCentsGerman(cents: number): string {
  const v = Math.round(cents);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const major = Math.floor(abs / 100);
  const minor = String(abs % 100).padStart(2, '0');
  return `${sign}${major},${minor} €`;
}

/**
 * Parse a user-typed decimal (German or English) into integer cents.
 * Returns null when unparseable.
 */
export function parseCents(input: string): number | null {
  const s = input.trim().replace(/\s/g, '').replace(/€/g, '');
  if (s === '') return null;
  let negative = false;
  let t = s;
  if (t.startsWith('-')) {
    negative = true;
    t = t.slice(1);
  }
  if (!/^\d*[.,]?\d*$/.test(t) || t === '' || t === '.' || t === ',') return null;

  const comma = t.lastIndexOf(',');
  const dot = t.lastIndexOf('.');
  let intPart: string;
  let fracPart = '';
  if (comma >= 0 && dot >= 0) {
    const dec = Math.max(comma, dot);
    const thousands = dec === comma ? '.' : ',';
    intPart = t.slice(0, dec).split(thousands).join('');
    fracPart = t.slice(dec + 1);
  } else if (comma >= 0) {
    intPart = t.slice(0, comma);
    fracPart = t.slice(comma + 1);
  } else if (dot >= 0) {
    intPart = t.slice(0, dot);
    fracPart = t.slice(dot + 1);
  } else {
    intPart = t;
  }
  if (intPart === '') intPart = '0';
  const frac = (fracPart + '00').slice(0, 2);
  const major = parseInt(intPart, 10);
  const minor = parseInt(frac, 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  let cents = major * 100 + minor;
  if (negative) cents = -cents;
  return cents;
}
