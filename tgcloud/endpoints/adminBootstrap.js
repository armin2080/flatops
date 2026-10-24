// endpoints/adminBootstrap.js — one-time, first-boot seeding of the setup code.
//
// This is the only write that is permitted while the household is
// uninitialised. It stores the owner-chosen setup code and the owner's Telegram
// id, then becomes a no-op. See docs/setup.md for the security model.

import { EndpointError } from 'sdk';
import { config } from '../lib/security/config.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });

  const existing = await config.getSetupCode();
  if (existing) {
    return { configured: true, already: true };
  }

  const setupCode = input && typeof input.setupCode === 'string' ? input.setupCode.trim() : '';
  if (setupCode.length < 6) {
    throw new EndpointError('The setup code must be at least 6 characters.', { code: 'BAD_CODE' });
  }

  await config.setSetupCode(setupCode);
  await config.setOwnerTgId(user.id);

  return { configured: true, already: false, ownerTgId: user.id };
}
