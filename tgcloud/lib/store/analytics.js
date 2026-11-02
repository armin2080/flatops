// store/analytics.js — assemble confirmed receipts into monthly analytics.

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { receipts, receiptItems, adjustments } from '../../schema.js';
import { computeMonthlyAnalytics, monthOf } from '../analytics/analytics.js';
import { categoryList } from '../analytics/categories.js';

/**
 * Load confirmed receipts (with items + adjustments) and compute analytics for a
 * given month ('YYYY-MM' or null for all time). Returns the categories list,
 * available months, and the aggregation result.
 */
export async function getAnalyticsData(month = null) {
  const confirmed = await db.select()
    .from(receipts)
    .where(eq(receipts.status, 'confirmed'))
    .all();

  const enriched = [];
  const availableMonths = new Set();
  for (const r of confirmed) {
    const m = monthOf(r.purchaseDate);
    if (m) availableMonths.add(m);

    const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, r.id)).all();
    const adjs = await db.select().from(adjustments).where(eq(adjustments.receiptId, r.id)).all();
    enriched.push({ purchaseDate: r.purchaseDate, items, adjustments: adjs });
  }

  const result = computeMonthlyAnalytics(enriched, month);

  return {
    categories: categoryList(),
    month: month && month !== 'all' ? month : null,
    availableMonths: [...availableMonths].sort(),
    ...result,
  };
}
