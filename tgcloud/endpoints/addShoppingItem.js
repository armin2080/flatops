// endpoints/addShoppingItem.js — add one or more items to the shopping list.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { addShoppingItems } from '../lib/store/shopping.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  const p = await requireParticipantByTgId(user.id);

  const texts = input && input.texts;
  if (!texts && !(input && input.text)) {
    throw new EndpointError('Provide item text(s).', { code: 'BAD_INPUT' });
  }
  return addShoppingItems(texts || [input.text], p.id);
}
