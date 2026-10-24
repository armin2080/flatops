// endpoints/getParticipants.js — the two household participants (for the payer
// selector in the review UI).

import { EndpointError } from 'sdk';
import { requireParticipantByTgId, getOrderedParticipants } from '../lib/security/auth.js';

export default async function (_input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  const { a, b } = await getOrderedParticipants();
  return [a, b].filter(Boolean).map((p) => ({
    id: p.id, tgId: p.tgId, displayName: p.displayName, role: p.role,
  }));
}
