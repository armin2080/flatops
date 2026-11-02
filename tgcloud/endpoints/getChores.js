// endpoints/getChores.js — list household chores with status and assignee.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { listChores, evaluateAndRemind } from '../lib/store/chores.js';

export default async function (_input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  // Opening the app is a natural moment to fire any due reminders.
  await evaluateAndRemind();
  return listChores();
}
