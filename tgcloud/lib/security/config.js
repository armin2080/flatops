// config.js — access to the settings key/value store.
//
// Secret values (the AI provider key) live only in the `settings` table. They
// are never written to logs, never returned to the Mini App, and never placed
// in source or the frontend.

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { settings } from '../../schema.js';

const SETTING_KEYS = {
  setupCode: 'setup_code',
  ownerTgId: 'owner_tg_id',
  aiProvider: 'ai_provider',
  aiApiKey: 'ai_api_key',
  aiModel: 'ai_model',
  aiBaseUrl: 'ai_base_url',
  miniAppUrl: 'mini_app_url',
};

/**
 * Load all settings into a plain object (includes the secret key — callers must
 * not log or forward it).
 */
export async function loadSettings() {
  const rows = await db.select().from(settings).all();
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    setupCode: map[SETTING_KEYS.setupCode] ?? null,
    ownerTgId: map[SETTING_KEYS.ownerTgId] ?? null,
    aiProvider: map[SETTING_KEYS.aiProvider] ?? 'openai',
    aiApiKey: map[SETTING_KEYS.aiApiKey] ?? null,
    aiModel: map[SETTING_KEYS.aiModel] ?? null,
    aiBaseUrl: map[SETTING_KEYS.aiBaseUrl] ?? null,
    miniAppUrl: map[SETTING_KEYS.miniAppUrl] ?? null,
  };
}

/**
 * Non-secret settings, safe to return to the admin's Mini App.
 */
export async function loadPublicSettings() {
  const s = await loadSettings();
  return {
    aiProvider: s.aiProvider,
    aiModel: s.aiModel,
    aiBaseUrl: s.aiBaseUrl,
    miniAppUrl: s.miniAppUrl,
    hasApiKey: Boolean(s.aiApiKey),
    setupConfigured: Boolean(s.setupCode),
  };
}

async function setSetting(key, value) {
  await db.insert(settings)
    .values({ key, value, updatedAt: Math.floor(Date.now() / 1000) })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: Math.floor(Date.now() / 1000) } })
    .run();
}

export async function getSetting(key) {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? row.value : null;
}

export const config = {
  async getSetupCode() {
    return getSetting(SETTING_KEYS.setupCode);
  },
  async setSetupCode(value) {
    await setSetting(SETTING_KEYS.setupCode, value);
  },
  async getOwnerTgId() {
    const v = await getSetting(SETTING_KEYS.ownerTgId);
    return v == null ? null : Number(v);
  },
  async setOwnerTgId(value) {
    await setSetting(SETTING_KEYS.ownerTgId, String(value));
  },
  async getAiApiKey() {
    return getSetting(SETTING_KEYS.aiApiKey);
  },
  async setAiApiKey(value) {
    await setSetting(SETTING_KEYS.aiApiKey, value);
  },
  async getAiProvider() {
    return (await getSetting(SETTING_KEYS.aiProvider)) || 'openai';
  },
  async setAiProvider(value) {
    await setSetting(SETTING_KEYS.aiProvider, value);
  },
  async getAiModel() {
    return getSetting(SETTING_KEYS.aiModel);
  },
  async setAiModel(value) {
    await setSetting(SETTING_KEYS.aiModel, value);
  },
  async getAiBaseUrl() {
    return getSetting(SETTING_KEYS.aiBaseUrl);
  },
  async setAiBaseUrl(value) {
    await setSetting(SETTING_KEYS.aiBaseUrl, value);
  },
  async getMiniAppUrl() {
    return getSetting(SETTING_KEYS.miniAppUrl);
  },
  async setMiniAppUrl(value) {
    await setSetting(SETTING_KEYS.miniAppUrl, value);
  },
};
