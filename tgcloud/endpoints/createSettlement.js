// endpoints/createSettlement.js — record an off-platform transfer between the
// two participants. Identity comes from the verified init data.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { createSettlement } from '../lib/store/receipts.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  return createSettlement({
    senderId: input && input.senderId,
    receiverId: input && input.receiverId,
    amountCents: input && input.amountCents,
    note: input && input.note,
    settledAt: input && input.settledAt,
  });
}
