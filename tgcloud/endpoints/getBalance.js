// endpoints/getBalance.js — current household balance for the Mini App.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId, getOrderedParticipants } from '../lib/security/auth.js';
import { currentBalance } from '../lib/store/receipts.js';

export default async function (_input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  const { a, b } = await getOrderedParticipants();
  const balance = await currentBalance(a ? a.id : null);
  return {
    participants: [a, b].filter(Boolean).map((p) => ({
      id: p.id, tgId: p.tgId, displayName: p.displayName, role: p.role,
    })),
    nameA: (a && a.displayName) || 'Person A',
    nameB: (b && b.displayName) || 'Person B',
    balance,
  };
}
