// integrations/probe.js — test a specific model against a real stored receipt.
//
// Model catalogues change constantly and not every "big" model accepts images.
// Rather than guessing, this runs the real extraction pipeline on your most
// recent receipt image with a chosen model and reports whether it actually
// produced usable structured data.

import { api, db } from 'sdk';
import { desc, eq, isNotNull } from 'sdk/db';

import { receipts } from '../../schema.js';
import { extractReceipt } from './ocr.js';
import { loadSettings } from '../security/config.js';

/**
 * Pick the most recent receipt that still has an image reference.
 */
async function latestReceiptWithImage(receiptId) {
  if (receiptId) {
    const r = await db.select().from(receipts).where(eq(receipts.id, Number(receiptId))).get();
    if (r && r.fileId) return r;
    return null;
  }
  const rows = await db.select().from(receipts)
    .where(isNotNull(receipts.fileId))
    .orderBy(desc(receipts.id))
    .limit(1)
    .all();
  return rows[0] || null;
}

/**
 * Probe one model. Returns a plain, serialisable result (never throws).
 */
export async function probeModel(model, receiptId) {
  const out = { model, ok: false };
  try {
    const receipt = await latestReceiptWithImage(receiptId);
    if (!receipt) {
      return { ...out, error: 'No receipt with a stored image found. Upload one first.' };
    }
    out.receiptId = receipt.id;

    const settings = await loadSettings();
    const bytes = await api.getFileContent(receipt.fileId);
    if (!bytes || bytes.length === 0) {
      return { ...out, error: 'Could not download the receipt image.' };
    }

    const started = Date.now();
    const result = await extractReceipt(
      { ...settings, aiModel: model },
      bytes,
      receipt.mimeType || 'image/jpeg',
    );
    const elapsedMs = Date.now() - started;

    return {
      ...out,
      ok: true,
      elapsedMs,
      store: result.store || null,
      itemCount: result.items.length,
      printedTotalCents: result.totalCents,
      adjustmentCount: result.adjustments.length,
      warningCount: (result.warnings || []).length,
      sample: result.items.slice(0, 4).map((i) => i.originalName),
    };
  } catch (err) {
    const msg = err && err.message ? String(err.message) : String(err);
    return { ...out, error: msg.slice(0, 400) };
  }
}

/**
 * Probe several models sequentially, respecting provider rate limits.
 */
export async function probeModels(models, receiptId) {
  const results = [];
  for (const m of models) {
    results.push(await probeModel(m, receiptId));
  }
  return results;
}
