// endpoints/getHistory.js — recent receipts and settlements for the Mini App.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { recentReceipts, recentSettlements, participantNameMap } from '../lib/store/balance.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  const limit = Math.min(50, Math.max(1, Number(input && input.limit) || 20));
  const receipts = await recentReceipts(limit);
  const settlements = await recentSettlements(limit);
  const names = await participantNameMap();

  return {
    receipts: receipts.map((r) => ({
      id: r.id, store: r.store, date: r.purchaseDate, currency: r.currency,
      printedTotalCents: r.printedTotalCents, status: r.status,
      payerId: r.payerId, payerName: names[r.payerId] || null,
      createdAt: r.createdAt, confirmedAt: r.confirmedAt,
    })),
    settlements: settlements.map((s) => ({
      id: s.id, senderId: s.senderId, receiverId: s.receiverId,
      senderName: names[s.senderId] || '?', receiverName: names[s.receiverId] || '?',
      amountCents: s.amountCents, note: s.note, settledAt: s.settledAt,
    })),
  };
}
