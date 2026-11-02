// Typed calls to the Mini App backend endpoints.

import { serverlessCall } from './telegram';
import type {
  ReceiptView, BalanceViewPayload, HistoryPayload, Participant, ReceiptItem, Adjustment,
  ShoppingListPayload, AnalyticsPayload, ChoresPayload,
} from './types';

export function getReceipt(receiptId: number): Promise<ReceiptView> {
  return serverlessCall<ReceiptView>('getReceipt', { receiptId });
}

export interface SaveReceiptInput {
  receiptId: number;
  store: string | null;
  date: string | null;
  currency: string;
  payerId: number | null;
  printedTotalCents: number;
  items: Array<Partial<ReceiptItem>>;
  adjustments: Array<Partial<Adjustment>>;
}

export function saveReceipt(input: SaveReceiptInput): Promise<ReceiptView> {
  return serverlessCall<ReceiptView>('saveReceipt', input);
}

export function confirmReceipt(receiptId: number): Promise<{ receiptId: number; balance: BalanceViewPayload['balance']; alreadyConfirmed: boolean }> {
  return serverlessCall('confirmReceipt', { receiptId });
}

export function cancelReceipt(receiptId: number): Promise<{ receiptId: number; status: string }> {
  return serverlessCall('cancelReceipt', { receiptId });
}

export function removeReceipt(receiptId: number): Promise<{ receiptId: number; removed: boolean }> {
  return serverlessCall('removeReceipt', { receiptId });
}

export function createSettlement(input: {
  senderId: number;
  receiverId: number;
  amountCents: number;
  note?: string;
}): Promise<{ settlement: unknown; balance: BalanceViewPayload['balance'] }> {
  return serverlessCall('createSettlement', input);
}

export function getBalance(): Promise<BalanceViewPayload> {
  return serverlessCall<BalanceViewPayload>('getBalance', {});
}

export function getHistory(limit = 30): Promise<HistoryPayload> {
  return serverlessCall<HistoryPayload>('getHistory', { limit });
}

export function getParticipants(): Promise<Participant[]> {
  return serverlessCall<Participant[]>('getParticipants', {});
}

export function adminBootstrap(setupCode: string): Promise<{ configured: boolean; already: boolean }> {
  return serverlessCall('adminBootstrap', { setupCode });
}

export function getShoppingList(): Promise<ShoppingListPayload> {
  return serverlessCall<ShoppingListPayload>('getShoppingList', {});
}

export function addShoppingItems(texts: string[]): Promise<ShoppingListPayload> {
  return serverlessCall<ShoppingListPayload>('addShoppingItem', { texts });
}

export function updateShoppingItem(itemId: number, action: 'toggle' | 'edit' | 'delete', text?: string): Promise<ShoppingListPayload> {
  return serverlessCall<ShoppingListPayload>('updateShoppingItem', { itemId, action, text });
}

export function clearShoppingList(all = false): Promise<ShoppingListPayload> {
  return serverlessCall<ShoppingListPayload>('clearShoppingList', { all });
}

export function getAnalytics(month?: string): Promise<AnalyticsPayload> {
  return serverlessCall<AnalyticsPayload>('getAnalytics', { month });
}

export function getChores(): Promise<ChoresPayload> {
  return serverlessCall<ChoresPayload>('getChores', {});
}

export function saveChore(input: {
  id?: number;
  name: string;
  description?: string;
  frequencyDays: number;
  advanceDays: number;
  isActive?: boolean;
}): Promise<ChoresPayload> {
  return serverlessCall<ChoresPayload>('saveChore', input);
}

export function deleteChore(id: number): Promise<ChoresPayload> {
  return serverlessCall<ChoresPayload>('deleteChore', { id });
}

export function completeChore(id: number): Promise<ChoresPayload> {
  return serverlessCall<ChoresPayload>('completeChore', { id });
}
