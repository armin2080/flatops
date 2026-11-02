// schema.js — FlatOps database schema.
//
// Single source of truth for all tables. Telegram Serverless runs SQLite with
// PRAGMA foreign_keys OFF, so relationships are plain columns and referential
// integrity is enforced in application code (parents inserted before children,
// orphans swept as needed). See docs/architecture.md.
//
// Deploy with `npx tgcloud push`, then apply with `npx tgcloud migrate`.

import {
  table, integer, real, text, boolean, json,
  index, uniqueIndex, sql,
} from 'sdk/db';

// --- Participants ---------------------------------------------------------
// Exactly two active participants per household. `role` is 'admin' for the
// first registrant, 'member' for the second. `tgId` is the immutable Telegram
// numeric user id — never a username.
export const participants = table('participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tgId: integer('tg_id').notNull().unique(),
  displayName: text('display_name'),
  role: text('role').notNull().default('member'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  tgIdx: uniqueIndex('uidx_participants_tg_id').on(t.tgId),
}));

// --- Receipts -------------------------------------------------------------
export const receipts = table('receipts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  store: text('store'),
  purchaseDate: text('purchase_date'),
  currency: text('currency').notNull().default('EUR'),
  printedTotalCents: integer('printed_total_cents').notNull(),
  calculatedTotalCents: integer('calculated_total_cents'),
  discrepancyCents: integer('discrepancy_cents'),
  payerId: integer('payer_id'),
  submittedById: integer('submitted_by_id'),
  status: text('status').notNull().default('processing'),
  fingerprint: text('fingerprint'),
  semanticFingerprint: text('semantic_fingerprint'),
  fileId: text('file_id'),
  fileUniqueId: text('file_unique_id'),
  mimeType: text('mime_type'),
  rawExtraction: json('raw_extraction'),
  warnings: json('warnings'),
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  duplicateOfId: integer('duplicate_of_id'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  processedAt: integer('processed_at'),
  confirmedAt: integer('confirmed_at'),
}, (t) => ({
  statusIdx: index('idx_receipts_status').on(t.status),
  fpIdx: index('idx_receipts_fingerprint').on(t.fingerprint),
  semIdx: index('idx_receipts_sem_fp').on(t.semanticFingerprint),
}));

// --- Receipt items --------------------------------------------------------
export const receiptItems = table('receipt_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  receiptId: integer('receipt_id').notNull(),
  position: integer('position').notNull().default(0),
  originalName: text('original_name'),
  englishName: text('english_name'),
  quantity: real('quantity'),
  unit: text('unit'),
  unitPriceCents: integer('unit_price_cents'),
  lineTotalCents: integer('line_total_cents').notNull(),
  category: text('category'),
  allocationType: text('allocation_type').notNull().default('shared'),
  allocationACents: integer('allocation_a_cents'),
  confidence: real('confidence'),
  isUncertain: boolean('is_uncertain').notNull().default(false),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  receiptIdx: index('idx_items_receipt').on(t.receiptId),
}));

// --- Adjustments (discounts, Pfand, other charges) ------------------------
export const adjustments = table('adjustments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  receiptId: integer('receipt_id').notNull(),
  position: integer('position').notNull().default(0),
  kind: text('kind').notNull().default('other'),
  label: text('label'),
  amountCents: integer('amount_cents').notNull(),
  allocationType: text('allocation_type').notNull().default('shared'),
  allocationACents: integer('allocation_a_cents'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  receiptIdx: index('idx_adjustments_receipt').on(t.receiptId),
}));

// --- Shopping list --------------------------------------------------------
// A single shared checklist. Items are checked off by whichever participant is
// shopping; checked items are cleared to start the next week.
export const shoppingItems = table('shopping_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  checked: boolean('checked').notNull().default(false),
  addedBy: integer('added_by'),
  checkedBy: integer('checked_by'),
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  checkedAt: integer('checked_at'),
}, (t) => ({
  checkedIdx: index('idx_shopping_checked').on(t.checked),
}));

// --- Settlements ----------------------------------------------------------
// Records an off-platform transfer between the two participants. Sender and
// receiver are participant ids; amount is a positive integer-cent value.
export const settlements = table('settlements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  senderId: integer('sender_id').notNull(),
  receiverId: integer('receiver_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  note: text('note'),
  settledAt: integer('settled_at'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  senderIdx: index('idx_settlements_sender').on(t.senderId),
  receiverIdx: index('idx_settlements_receiver').on(t.receiverId),
}));

// --- Allocation preferences ----------------------------------------------
// Remembers the most recent allocation decision per product key.
export const allocationPreferences = table('allocation_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull(),
  allocationType: text('allocation_type').notNull(),
  allocationACents: integer('allocation_a_cents'),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  keyIdx: uniqueIndex('uidx_prefs_key').on(t.key),
}));

// --- Chores (recurring household routines) --------------------------------
// A chore recurs every `frequencyDays`. The assignee rotates deterministically
// between the two participants (whoever didn't do it last does it next).
export const chores = table('chores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  frequencyDays: integer('frequency_days').notNull().default(7),
  advanceDays: integer('advance_days').notNull().default(1),
  createdBy: integer('created_by'),
  isActive: boolean('is_active').notNull().default(true),
  lastCompletedAt: integer('last_completed_at'),
  lastCompletedBy: integer('last_completed_by'),
  completedCount: integer('completed_count').notNull().default(0),
  reminderLevel: integer('reminder_level').notNull().default(0),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  activeIdx: index('idx_chores_active').on(t.isActive),
}));

export const choreCompletions = table('chore_completions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  choreId: integer('chore_id').notNull(),
  completedBy: integer('completed_by'),
  completedAt: integer('completed_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  choreIdx: index('idx_chore_completions_chore').on(t.choreId),
}));

// --- Settings -------------------------------------------------------------
// Key/value store for configuration. Secret values (AI API key) live ONLY here,
// never in source, the frontend, or logs.
export const settings = table('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});

// --- Pending actions ------------------------------------------------------
// Short-lived, per-user conversational state (e.g. the amount step of the
// settlement flow).
export const pendingActions = table('pending_actions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tgId: integer('tg_id').notNull(),
  action: text('action').notNull(),
  payload: json('payload'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  tgIdx: index('idx_pending_tg').on(t.tgId),
}));
