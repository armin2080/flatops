// validate.js — structural validation and normalisation of AI extraction.
//
// The provider returns arbitrary text; we never trust it. This module turns the
// parsed JSON into a strictly normalised, cents-based structure, preserving the
// original German product name, keeping a separate English translation, marking
// uncertain fields for human review, and separating unit price from line total.

import { parseMoneyToCents, normalizeCurrency } from '../money.js';
import { normalizeCategory, categorizeItem } from '../analytics/categories.js';

const KNOWN_UNITS = new Set([
  'kg', 'g', 'l', 'ml', 'cl', 'stück', 'stk', 'st', 'pcs', 'pack', 'x', 'flasche',
  'dose', 'kasten', 'bund', 'beutel', 'glas', 'tube', 'rolle', 'paar', 'päckchen',
]);

const KIND_WORDS = {
  pfand: ['pfand', 'deposit', 'flaschenpfand', 'leergut', 'einweg'],
  discount: ['discount', 'rabatt', 'reduction', 'ermäßigung', 'abzug', 'bonus', 'coupon', 'gutschein'],
  refund: ['refund', 'rückerstattung', 'erstattung', 'retoure', 'gutschrift'],
};

function normalizeConfidence(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function normalizeQuantity(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(',', '.');
  if (s === '') return null;
  // "2 x 1,5 l" style: take the first number that looks like a quantity.
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function normalizeUnit(value) {
  if (typeof value !== 'string') return '';
  const u = value.trim().toLowerCase();
  if (!u) return '';
  // Normalise common abbreviations.
  if (u === 'st' || u === 'stk' || u === 'pcs' || u === 'stück') return 'Stück';
  return u;
}

// German receipts often print a product name on one line and its count on the
// next, indented line — e.g. "Vollkornbrot" then "2 x 1,79". A vision model may
// emit that count line as a separate item with no product name. Detect and merge
// it back into the preceding item.
const QUANTITY_CONTINUATION_RE = /^\s*(\d+)\s*[x×·*]\s*(\d*[.,]?\d*)?\s*(?:€|EUR)?\s*$/i;

function parseQuantityContinuation(name) {
  if (typeof name !== 'string') return null;
  const m = name.trim().match(QUANTITY_CONTINUATION_RE);
  if (!m) return null;
  const quantity = parseInt(m[1], 10);
  if (!Number.isFinite(quantity)) return null;
  const unitPriceCents = m[2] ? parseMoneyToCents(m[2]) : null;
  return { quantity, unitPriceCents };
}

/**
 * Merge "count continuation" lines into the item above them.
 */
function mergeQuantityContinuations(items, warnings) {
  const merged = [];
  for (const it of items) {
    const cont = parseQuantityContinuation(it.originalName);
    if (cont && merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (prev.quantity == null) prev.quantity = cont.quantity;
      if (prev.unitPriceCents == null && cont.unitPriceCents != null) {
        prev.unitPriceCents = cont.unitPriceCents;
      }
      if (prev.lineTotalCents === 0) {
        if (Number.isInteger(prev.quantity) && prev.unitPriceCents != null) {
          prev.lineTotalCents = prev.quantity * prev.unitPriceCents;
        } else if (it.lineTotalCents > 0) {
          prev.lineTotalCents = it.lineTotalCents;
        }
      }
      if (cont.quantity > 1) {
        warnings.push(`Merged a "x${cont.quantity}" count line into "${prev.originalName}".`);
      }
      continue;
    }
    merged.push(it);
  }
  return merged;
}

/**
 * Infer an adjustment kind from its label and signed amount.
 */
export function inferAdjustmentKind(kind, label, amountCents) {
  const hay = `${kind ?? ''} ${label ?? ''}`.toLowerCase();
  for (const k of ['pfand', 'refund', 'discount']) {
    if (KIND_WORDS[k].some((w) => hay.includes(w))) return k;
  }
  if (amountCents != null && amountCents < 0) return 'discount';
  return 'other';
}

function normalizeDate(value) {
  if (typeof value !== 'string') return '';
  const s = value.trim();
  // Accept ISO dates, or German DD.MM.YYYY.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [ , y, m, d ] = iso;
    return `${y}-${m}-${d}`;
  }
  const de = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (de) {
    const [ , d, m, y ] = de;
    return `${y}-${m}-${d}`;
  }
  return s;
}

/**
 * Normalise a parsed extraction object into a validated receipt structure.
 *
 * Always returns `{ ok, ... }`. On structural failure `ok` is false and
 * `errors` explains why. On success `ok` is true and includes `items`,
 * `adjustments`, `warnings`, and receipt metadata.
 */
export function normalizeExtraction(raw) {
  const warnings = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['No structured receipt data was returned by the provider.'] };
  }

  const store = typeof raw.store === 'string' ? raw.store.trim() : '';
  const currency = normalizeCurrency(raw.currency);
  const date = normalizeDate(raw.date);
  const totalCents = parseMoneyToCents(raw.total ?? raw.total_amount ?? raw.grand_total ?? raw.sum);

  const rawItems = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.products) ? raw.products : [];

  let items = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i] || {};
    const original = (typeof it.original === 'string' && it.original.trim()) ||
      (typeof it.name === 'string' && it.name.trim()) ||
      (typeof it.description === 'string' && it.description.trim()) ||
      '';
    if (!original) {
      warnings.push(`Line ${i + 1} could not be read (no product name).`);
      continue;
    }
    const english = (typeof it.english === 'string' && it.english.trim()) ||
      (typeof it.translation === 'string' && it.translation.trim()) || '';

    const lineTotalCents = parseMoneyToCents(it.line_total ?? it.total ?? it.price ?? it.amount);
    const unitPriceCents = parseMoneyToCents(it.unit_price ?? it.price_per_unit ?? it.unitPrice);
    const quantity = normalizeQuantity(it.quantity);
    const unit = normalizeUnit(it.unit);
    const confidence = normalizeConfidence(it.confidence);
    const isUncertain = confidence === null || confidence < 0.6;

    if (lineTotalCents === null) {
      warnings.push(`"${original}" has no recognised price — mark for review.`);
    }
    if (!english) {
      warnings.push(`"${original}" is missing an English translation.`);
    }

    items.push({
      originalName: original,
      englishName: english,
      quantity,
      unit,
      unitPriceCents,
      lineTotalCents: lineTotalCents === null ? 0 : lineTotalCents,
      category: normalizeCategory(it.category) || categorizeItem(original, english),
      confidence,
      isUncertain,
    });
  }

  // Re-attach indented count lines (e.g. "2 x 1,79") to the item above.
  items = mergeQuantityContinuations(items, warnings);

  const rawAdjustments = Array.isArray(raw.adjustments)
    ? raw.adjustments
    : Array.isArray(raw.discounts) || Array.isArray(raw.deposits)
      ? [...(raw.discounts || []), ...(raw.deposits || [])]
      : [];

  const adjustments = [];
  for (let i = 0; i < rawAdjustments.length; i++) {
    const a = rawAdjustments[i] || {};
    const label = (typeof a.label === 'string' && a.label.trim()) ||
      (typeof a.name === 'string' && a.name.trim()) || '';
    const amountCents = parseMoneyToCents(a.amount ?? a.value ?? a.total);
    if (amountCents === null) {
      warnings.push(`Adjustment "${label || i + 1}" has no recognised amount — mark for review.`);
      continue;
    }
    const kind = inferAdjustmentKind(a.kind, label, amountCents);
    adjustments.push({ kind, label: label || kind, amountCents });
  }

  if (totalCents === null) {
    warnings.push('The receipt grand total could not be recognised.');
  }
  if (items.length === 0) {
    warnings.push('No product lines were recognised on this receipt.');
  }

  return {
    ok: true,
    store,
    date,
    currency,
    totalCents: totalCents === null ? 0 : totalCents,
    items,
    adjustments,
    warnings,
  };
}
