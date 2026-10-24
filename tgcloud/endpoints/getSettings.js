// endpoints/getSettings.js — non-secret configuration for the admin's Mini App.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { loadPublicSettings } from '../lib/security/config.js';

export default async function (_input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  const p = await requireParticipantByTgId(user.id);
  if (p.role !== 'admin') {
    throw new EndpointError('Only the admin can view settings.', { code: 'FORBIDDEN' });
  }
  return loadPublicSettings();
}
