// endpoints/clearShoppingList.js — clear checked items (or the whole list).

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { clearCheckedItems, clearAllItems } from '../lib/store/shopping.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  if (input && input.all) return clearAllItems();
  return clearCheckedItems();
}
