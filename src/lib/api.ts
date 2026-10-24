// Typed calls to the Mini App backend endpoints.

import { serverlessCall } from './telegram';
import type {
  ReceiptView, BalanceViewPayload, HistoryPayload, Participant, ReceiptItem, Adjustment,
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
