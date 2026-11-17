// endpoints/adminConfigure.js — admin-only provider configuration.
//
// Telegram Serverless has no `process.env` and no filesystem, so a `.env` file
// cannot be read by the deployed code. This endpoint is the bridge: a local
// script (`scripts/set-key.mjs`) reads `.env` and pushes the values here, which
// stores them in the private `settings` table.
//
// Only an admin participant may call it, and the key is never returned.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId } from '../lib/security/auth.js';
import { config, loadPublicSettings } from '../lib/security/config.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });

  const p = await requireParticipantByTgId(user.id);
  if (p.role !== 'admin') {
    throw new EndpointError('Only the admin can change configuration.', { code: 'FORBIDDEN' });
  }

  const src = input || {};
  const applied = [];

  if (typeof src.apiKey === 'string' && src.apiKey.trim()) {
    await config.setAiApiKey(src.apiKey.trim());
    applied.push('apiKey');
  }
  if (typeof src.provider === 'string' && src.provider.trim()) {
    await config.setAiProvider(src.provider.trim().toLowerCase());
    applied.push('provider');
  }
  if (typeof src.model === 'string' && src.model.trim()) {
    await config.setAiModel(src.model.trim());
    applied.push('model');
  }
  if (typeof src.baseUrl === 'string' && src.baseUrl.trim()) {
    await config.setAiBaseUrl(src.baseUrl.trim());
    applied.push('baseUrl');
  }
  if (typeof src.miniAppUrl === 'string' && src.miniAppUrl.trim()) {
    await config.setMiniAppUrl(src.miniAppUrl.trim());
    applied.push('miniAppUrl');
  }

  if (applied.length === 0) {
    throw new EndpointError('Nothing to configure. Provide apiKey/provider/model/baseUrl.', { code: 'BAD_INPUT' });
  }

  // Return only non-secret state so the caller can confirm what landed.
  return { applied, settings: await loadPublicSettings() };
}
