// endpoints/getShoppingList.js — the current shared shopping list.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { getShoppingList } from '../lib/store/shopping.js';

export default async function (_input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);
  return getShoppingList();
}
