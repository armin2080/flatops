// endpoints/completeChore.js — mark a chore done (rotates assignee).

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { completeChore } from '../lib/store/chores.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  const p = await requireParticipantByTgId(user.id);

  const choreId = Number(input && input.id);
  if (!Number.isFinite(choreId) || choreId <= 0) {
    throw new EndpointError('A valid chore id is required.', { code: 'BAD_INPUT' });
  }
  return completeChore(choreId, p.id);
}
