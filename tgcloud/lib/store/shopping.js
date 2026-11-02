// store/shopping.js — database access for the shared shopping list.

import { db, EndpointError } from 'sdk';
import { eq, asc } from 'sdk/db';
import { shoppingItems, participants } from '../../schema.js';

const now = () => Math.floor(Date.now() / 1000);

async function mapRows(rows) {
  const names = {};
  const people = await db.select().from(participants).all();
  for (const p of people) names[p.id] = p.displayName || `User ${p.tgId}`;

  return rows.map((it) => ({
    id: it.id,
    text: it.text,
    checked: Boolean(it.checked),
    addedBy: it.addedBy,
    addedByName: it.addedBy ? names[it.addedBy] || null : null,
    checkedBy: it.checkedBy,
    checkedByName: it.checkedBy ? names[it.checkedBy] || null : null,
    position: it.position,
    createdAt: it.createdAt,
    checkedAt: it.checkedAt,
  }));
}

/**
 * Load the full shopping list (unchecked first, then checked, each in order).
 */
export async function getShoppingList() {
  const rows = await db.select()
    .from(shoppingItems)
    .orderBy(asc(shoppingItems.checked), asc(shoppingItems.position), asc(shoppingItems.id))
    .all();
  const items = await mapRows(rows);
  return {
    items,
    remaining: items.filter((i) => !i.checked).length,
    done: items.filter((i) => i.checked).length,
  };
}

/**
 * Add one or more items to the list.
 */
export async function addShoppingItems(texts, addedBy) {
  const list = Array.isArray(texts) ? texts : [texts];
  const cleaned = list
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => t.length > 0 && t.length <= 200);

  if (cleaned.length === 0) {
    throw new EndpointError('Add at least one item.', { code: 'EMPTY_ITEM' });
  }

  const maxRow = await db.select().from(shoppingItems)
    .orderBy(asc(shoppingItems.position))
    .all();
  let position = maxRow.length ? Math.max(...maxRow.map((r) => r.position)) + 1 : 0;

  const rows = cleaned.map((text) => ({
    text,
    checked: false,
    addedBy: addedBy ?? null,
    position: position++,
    createdAt: now(),
  }));
  await db.insert(shoppingItems).values(rows).run();
  return getShoppingList();
}

/**
 * Update a single item (toggle checked, edit text, or delete).
 * `action` is 'toggle' | 'edit' | 'delete'.
 */
export async function updateShoppingItem({ itemId, action, text, checkedBy }) {
  const id = Number(itemId);
  const item = await db.select().from(shoppingItems).where(eq(shoppingItems.id, id)).get();
  if (!item) throw new EndpointError('Item not found.', { code: 'NOT_FOUND' });

  if (action === 'delete') {
    await db.delete(shoppingItems).where(eq(shoppingItems.id, id)).run();
  } else if (action === 'edit') {
    const t = typeof text === 'string' ? text.trim().slice(0, 200) : '';
    if (!t) throw new EndpointError('Item text cannot be empty.', { code: 'EMPTY_ITEM' });
    await db.update(shoppingItems).set({ text: t }).where(eq(shoppingItems.id, id)).run();
  } else {
    // toggle
    const next = !Boolean(item.checked);
    await db.update(shoppingItems)
      .set({
        checked: next,
        checkedBy: next ? (checkedBy ?? null) : null,
        checkedAt: next ? now() : null,
      })
      .where(eq(shoppingItems.id, id))
      .run();
  }

  return getShoppingList();
}

/**
 * Remove all checked items (starts the next week's list).
 */
export async function clearCheckedItems() {
  await db.delete(shoppingItems).where(eq(shoppingItems.checked, true)).run();
  return getShoppingList();
}

/**
 * Remove every item (fresh start).
 */
export async function clearAllItems() {
  await db.delete(shoppingItems).run();
  return getShoppingList();
}
