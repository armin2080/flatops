// endpoints/cancelReceipt.js — cancel a pending receipt.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { cancelReceipt } from '../lib/store/receipts.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  const receiptId = Number(input && input.receiptId);
  if (!Number.isFinite(receiptId) || receiptId <= 0) {
    throw new EndpointError('A valid receiptId is required.', { code: 'BAD_INPUT' });
  }
  return cancelReceipt(receiptId);
}
