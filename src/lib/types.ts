// Types mirroring the backend endpoint payloads.

export type AllocationType = 'shared' | 'person_a' | 'person_b' | 'custom';

export interface Participant {
  id: number;
  tgId: number;
  displayName: string | null;
  role: string;
}

export interface ReceiptItem {
  id?: number;
  position: number;
  originalName: string;
  englishName: string;
  quantity: number | null;
  unit: string;
  unitPriceCents: number | null;
  lineTotalCents: number;
  confidence: number | null;
  isUncertain: boolean;
  allocationType: string;
  allocationACents: number | null;
  suggestedType: string;
  suggestedACents: number | null;
  splitA: number;
  splitB: number;
}

export interface Adjustment {
  id?: number;
  position: number;
  kind: string;
  label: string;
  amountCents: number;
  allocationType: string;
  allocationACents: number | null;
  suggestedType: string;
  suggestedACents: number | null;
  splitA: number;
  splitB: number;
}

export interface Balance {
  netBalanceCents: number;
  aOwesBCents: number;
  bOwesACents: number;
  spentACents: number;
  spentBCents: number;
  sharedTotalCents: number;
}

export interface ReceiptView {
  receipt: {
    id: number;
    store: string | null;
    date: string | null;
    currency: string;
    printedTotalCents: number;
    calculatedTotalCents: number;
    discrepancyCents: number;
    status: string;
    payerId: number | null;
    submittedById: number | null;
    error: string | null;
    warnings: string[];
  };
  items: ReceiptItem[];
  adjustments: Adjustment[];
  participants: Participant[];
  totals: {
    respA: number;
    respB: number;
    total: number;
    itemsTotalCents: number;
    adjustmentsTotalCents: number;
    calculatedTotalCents: number;
    printedTotalCents: number;
    discrepancyCents: number;
    reconciled: boolean;
  };
  balance: Balance;
}

export interface BalanceViewPayload {
  participants: Participant[];
  nameA: string;
  nameB: string;
  balance: Balance;
}

export interface HistoryPayload {
  receipts: Array<{
    id: number;
    store: string | null;
    date: string | null;
    currency: string;
    printedTotalCents: number;
    status: string;
    payerId: number | null;
    payerName: string | null;
  }>;
  settlements: Array<{
    id: number;
    senderId: number;
    receiverId: number;
    senderName: string;
    receiverName: string;
    amountCents: number;
    note: string | null;
  }>;
}
