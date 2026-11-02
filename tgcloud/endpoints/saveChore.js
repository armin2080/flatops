// endpoints/saveChore.js — create or update a chore.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { createChore, updateChore } from '../lib/store/chores.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  const p = await requireParticipantByTgId(user.id);

  const choreId = input && input.id != null ? Number(input.id) : null;
  if (choreId) {
    return updateChore(choreId, input);
  }
  return createChore(input, p.id);
}
