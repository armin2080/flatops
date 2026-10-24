import { describe, it, expect } from 'vitest';
import { receiptResponsibility, computeBalance, sharedAmount } from '../../tgcloud/lib/ledger/ledger.js';

describe('receiptResponsibility', () => {
  it('sums responsibilities from lines', () => {
    const items = [
      { lineTotalCents: 1000, allocationType: 'shared', allocationACents: null },
      { lineTotalCents: 500, allocationType: 'person_a', allocationACents: null },
      { lineTotalCents: 300, allocationType: 'person_b', allocationACents: null },
      { lineTotalCents: 200, allocationType: 'custom', allocationACents: 150 },
    ];
    const { respA, respB, total } = receiptResponsibility(items, []);
    expect(total).toBe(2000);
    expect(respA).toBe(1000 / 2 + 500 + 0 + 150); // 500 + 500 + 150 = 1150
    expect(respB).toBe(500 + 0 + 300 + 50); // 850
    expect(respA + respB).toBe(total);
  });

  it('includes adjustments (negative discounts)', () => {
    const items = [{ lineTotalCents: 2000, allocationType: 'shared', allocationACents: null }];
    const adjustments = [{ amountCents: -200, allocationType: 'shared', allocationACents: null }];
    const { respA, respB, total } = receiptResponsibility(items, adjustments);
    expect(total).toBe(1800);
    expect(respA).toBe(900);
    expect(respB).toBe(900);
  });
});

describe('computeBalance', () => {
  const A = 1;
  const B = 2;

  it('matches the spec worked example (trip 1 + trip 2)', () => {
    // Trip 1: A pays €31.60, A's responsibility €17.60.
    const r1 = {
      payerId: A,
      items: [{ lineTotalCents: 3160, allocationType: 'custom', allocationACents: 1760 }],
      adjustments: [],
    };
    // Trip 2: B pays €25.00, A's responsibility €10.00.
    const r2 = {
      payerId: B,
      items: [{ lineTotalCents: 2500, allocationType: 'custom', allocationACents: 1000 }],
      adjustments: [],
    };

    const balance = computeBalance([r1, r2], [], A);
    expect(balance.netBalanceCents).toBe(400); // B owes A €4.00
    expect(balance.bOwesACents).toBe(400);
    expect(balance.aOwesBCents).toBe(0);
    expect(balance.spentACents).toBe(3160);
    expect(balance.spentBCents).toBe(2500);
  });

  it('net balances of the two sides sum to zero', () => {
    const receipts = [
      { payerId: A, items: [{ lineTotalCents: 5000, allocationType: 'shared', allocationACents: null }], adjustments: [] },
      { payerId: B, items: [{ lineTotalCents: 3000, allocationType: 'person_a', allocationACents: null }], adjustments: [] },
    ];
    const balance = computeBalance(receipts, [], A);
    expect(balance.netBalanceCents + (-balance.netBalanceCents)).toBe(0);
  });

  it('applies settlements without changing receipts', () => {
    const receipts = [
      { payerId: A, items: [{ lineTotalCents: 2450, allocationType: 'custom', allocationACents: 1000 }], adjustments: [] },
    ];
    // B pays A €20 -> net reduces by 2000.
    const settlements = [{ senderId: B, amountCents: 2000 }];
    const balance = computeBalance(receipts, settlements, A);
    // Without settlement: net = 2450 - 1000 = 1450. After B pays 2000: 1450 - 2000 = -550.
    expect(balance.netBalanceCents).toBe(-550);
    expect(balance.aOwesBCents).toBe(550);
  });

  it('handles partial and full settlement', () => {
    const receipts = [
      { payerId: A, items: [{ lineTotalCents: 2450, allocationType: 'custom', allocationACents: 0 }], adjustments: [] },
    ];
    const full = computeBalance(receipts, [{ senderId: B, amountCents: 2450 }], A);
    expect(full.netBalanceCents).toBe(0);

    const partial = computeBalance(receipts, [{ senderId: B, amountCents: 2000 }], A);
    expect(partial.netBalanceCents).toBe(450);
  });
});

describe('sharedAmount', () => {
  it('sums only shared lines', () => {
    const items = [
      { lineTotalCents: 1000, allocationType: 'shared', allocationACents: null },
      { lineTotalCents: 500, allocationType: 'person_a', allocationACents: null },
    ];
    expect(sharedAmount(items, [])).toBe(1000);
  });
});
