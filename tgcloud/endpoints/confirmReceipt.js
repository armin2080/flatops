// endpoints/confirmReceipt.js — idempotently confirm a reviewed receipt.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { confirmReceipt } from '../lib/store/receipts.js';
import { notifyReceiptConfirmed } from '../lib/bot/notify.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  const receiptId = Number(input && input.receiptId);
  if (!Number.isFinite(receiptId) || receiptId <= 0) {
    throw new EndpointError('A valid receiptId is required.', { code: 'BAD_INPUT' });
  }

  const result = await confirmReceipt(receiptId);

  // Tell the other roommate. Fire-and-forget so a notification failure never
  // rolls back an already-confirmed receipt.
  if (!result.alreadyConfirmed) {
    notifyReceiptConfirmed(user.id, result).catch(() => {});
  }
  return result;
}
