// endpoints/updateShoppingItem.js — toggle/check, edit, or delete a list item.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { updateShoppingItem } from '../lib/store/shopping.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  const p = await requireParticipantByTgId(user.id);

  const itemId = Number(input && input.itemId);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    throw new EndpointError('A valid itemId is required.', { code: 'BAD_INPUT' });
  }
  const action = (input && input.action) || 'toggle';
  if (!['toggle', 'edit', 'delete'].includes(action)) {
    throw new EndpointError('Invalid action.', { code: 'BAD_INPUT' });
  }
  return updateShoppingItem({
    itemId,
    action,
    text: input && input.text,
    checkedBy: action === 'toggle' ? p.id : undefined,
  });
}
