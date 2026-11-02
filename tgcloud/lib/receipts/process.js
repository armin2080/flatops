// receipts/process.js — the image -> structured receipt pipeline.
//
// Retrieves the image bytes, computes a fingerprint for duplicate detection,
// runs the configured OCR/vision provider, validates the result, and persists
// items + adjustments. Handles retries by re-running the pipeline in place.

import { api, db } from 'sdk';
import { eq } from 'sdk/db';

import { receipts, receiptItems, adjustments } from '../../schema.js';
import { hashBytes, semanticFingerprint } from './fingerprint.js';
import { extractReceipt } from '../integrations/ocr.js';
import { calculatedTotalCents, discrepancyCents } from './reconcile.js';
import { loadSettings } from '../security/config.js';
import { getParticipantByTgId } from '../security/auth.js';

const now = () => Math.floor(Date.now() / 1000);

const MAX_BYTES = 20 * 1024 * 1024; // Telegram getFile download ceiling.

/**
 * Create a pending receipt and run extraction.
 *
 * @returns {{kind: 'ok'|'error'|'duplicate_confirmed'|'duplicate_pending', ...}}
 */
export async function processNewReceipt({ tgId, fileId, fileUniqueId, mimeType }) {
  const participant = await getParticipantByTgId(tgId);
  if (!participant) return { kind: 'error', error: 'Not authorised.' };

  const bytes = await api.getFileContent(fileId);
  if (!bytes || bytes.length === 0) {
    return { kind: 'error', error: 'Could not download the image. Please try again.' };
  }
  if (bytes.length > MAX_BYTES) {
    return { kind: 'error', error: 'Image is too large to process.' };
  }

  const fingerprint = hashBytes(bytes);

  // Duplicate detection (same image bytes).
  const existing = await db.select().from(receipts).where(eq(receipts.fingerprint, fingerprint)).all();
  const confirmedDup = existing.find((r) => r.status === 'confirmed');
  if (confirmedDup) return { kind: 'duplicate_confirmed', duplicateOfId: confirmedDup.id };
  const pendingDup = existing.find((r) => r.status === 'awaiting_review' || r.status === 'processing');
  if (pendingDup) return { kind: 'duplicate_pending', duplicateOfId: pendingDup.id };

  const [receipt] = await db.insert(receipts).values({
    status: 'processing',
    fingerprint,
    fileId,
    fileUniqueId,
    mimeType: mimeType || 'image/jpeg',
    submittedById: participant.id,
    payerId: participant.id,
    printedTotalCents: 0,
    createdAt: now(),
  }).returning().run();

  return processReceiptImage(receipt.id, bytes, mimeType);
}

/**
 * Run extraction for an existing receipt (also used for retries).
 */
export async function processReceiptImage(receiptId, providedBytes, mimeType) {
  const receipt = await db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!receipt) return { kind: 'error', receiptId, error: 'Receipt not found.' };

  await db.update(receipts)
    .set({ status: 'processing', error: null })
    .where(eq(receipts.id, receiptId))
    .run();

  try {
    const settings = await loadSettings();
    const bytes = providedBytes || (await api.getFileContent(receipt.fileId));
    if (!bytes || bytes.length === 0) throw new Error('Could not download the image.');

    const extraction = await extractReceipt(settings, bytes, mimeType || receipt.mimeType || 'image/jpeg');

    const semFp = semanticFingerprint({
      store: extraction.store,
      date: extraction.date,
      totalCents: extraction.totalCents,
      itemTotals: extraction.items.map((i) => i.lineTotalCents),
    });

    const calc = calculatedTotalCents(extraction.items, extraction.adjustments);
    const disc = discrepancyCents(extraction.totalCents, extraction.items, extraction.adjustments);

    // Replace children (retry-safe).
    await db.delete(receiptItems).where(eq(receiptItems.receiptId, receiptId)).run();
    await db.delete(adjustments).where(eq(adjustments.receiptId, receiptId)).run();

    const itemRows = extraction.items.map((it, i) => ({
      receiptId,
      position: i,
      originalName: it.originalName,
      englishName: it.englishName,
      quantity: it.quantity,
      unit: it.unit,
      unitPriceCents: it.unitPriceCents,
      lineTotalCents: it.lineTotalCents,
      category: it.category || 'other',
      confidence: it.confidence,
      isUncertain: it.isUncertain,
      allocationType: 'shared',
      allocationACents: null,
      createdAt: now(),
    }));
    const adjRows = extraction.adjustments.map((a, i) => ({
      receiptId,
      position: i,
      kind: a.kind,
      label: a.label,
      amountCents: a.amountCents,
      allocationType: 'shared',
      allocationACents: null,
      createdAt: now(),
    }));

    if (itemRows.length) await db.insert(receiptItems).values(itemRows).run();
    if (adjRows.length) await db.insert(adjustments).values(adjRows).run();

    await db.update(receipts)
      .set({
        store: extraction.store,
        purchaseDate: extraction.date,
        currency: extraction.currency,
        printedTotalCents: extraction.totalCents,
        calculatedTotalCents: calc,
        discrepancyCents: disc,
        semanticFingerprint: semFp,
        rawExtraction: extraction,
        warnings: extraction.warnings,
        status: 'awaiting_review',
        processedAt: now(),
        error: null,
      })
      .where(eq(receipts.id, receiptId))
      .run();

    return {
      kind: 'ok',
      receiptId,
      store: extraction.store,
      itemCount: extraction.items.length,
      printedTotalCents: extraction.totalCents,
      discrepancyCents: disc,
      warnings: extraction.warnings || [],
    };
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'Unknown error';
    await db.update(receipts)
      .set({
        status: 'failed',
        error: message,
        processedAt: now(),
        retryCount: (receipt.retryCount || 0) + 1,
      })
      .where(eq(receipts.id, receiptId))
      .run();
    return { kind: 'error', receiptId, error: message };
  }
}
