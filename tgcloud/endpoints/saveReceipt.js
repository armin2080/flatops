// endpoints/saveReceipt.js — persist edits to a receipt draft (items,
// adjustments, payer, metadata) and return the recomputed view.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { saveReceiptDraft } from '../lib/store/receipts.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  const draft = input || {};
  const receiptId = Number(draft.receiptId);
  if (!Number.isFinite(receiptId) || receiptId <= 0) {
    throw new EndpointError('A valid receiptId is required.', { code: 'BAD_INPUT' });
  }
  return saveReceiptDraft(receiptId, draft);
}
