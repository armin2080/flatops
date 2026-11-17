#!/usr/bin/env node
// scripts/set-key.mjs — push AI provider config from a local `.env` into the
// deployed bot's settings table.
//
// WHY THIS EXISTS
//   Telegram Serverless runs in a V8 isolate with no `process.env`, no
//   filesystem and no `Buffer`. Deployed code therefore CANNOT read `.env`.
//   The only secure runtime store is the bot's `settings` table. This script
//   reads `.env` locally and calls the admin-only `adminConfigure` endpoint via
//   the tgcloud CLI, so your key never goes into source control or the frontend.
//
// USAGE
//   cp .env.example .env      # then fill in the values
//   npm run set-key
//
// ENV VARS (see .env.example)
//   AI_API_KEY       required  provider secret key
//   AI_PROVIDER      optional  academiccloud | groq | openai | openai_compatible
//   AI_MODEL         optional  e.g. qwen3-omni-30b-a3b-instruct
//   AI_BASE_URL      optional  only for custom OpenAI-compatible gateways
//   MINI_APP_URL     optional  https://app<id>.tgcloud.ai/
//   ADMIN_TG_ID      required  your Telegram user id (/whoami) — must be the admin
//
// The script never prints the key back.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes and inline comments (# after whitespace).
    value = value.replace(/\s+#.*$/, '');
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!existsSync(envPath)) {
  fail(`No .env found at ${envPath}\n\n  cp .env.example .env   # then fill it in`);
}

const env = parseEnv(readFileSync(envPath, 'utf8'));

const adminTgId = env.ADMIN_TG_ID;
if (!adminTgId) fail('ADMIN_TG_ID is missing from .env (send /whoami to the bot to get it).');
if (!/^\d+$/.test(adminTgId)) fail('ADMIN_TG_ID must be your numeric Telegram user id.');

if (!env.AI_API_KEY) fail('AI_API_KEY is missing from .env.');

const payload = { apiKey: env.AI_API_KEY };
if (env.AI_PROVIDER) payload.provider = env.AI_PROVIDER;
if (env.AI_MODEL) payload.model = env.AI_MODEL;
if (env.AI_BASE_URL) payload.baseUrl = env.AI_BASE_URL;
if (env.MINI_APP_URL) payload.miniAppUrl = env.MINI_APP_URL;

// Show what will be applied, masking the secret.
const shown = { ...payload, apiKey: `${env.AI_API_KEY.slice(0, 4)}…${env.AI_API_KEY.slice(-2)}` };
console.log('Applying configuration:', shown);

const ctx = JSON.stringify({ initData: { user: { id: Number(adminTgId) } } });
const args = ['tgcloud', 'run', 'endpoints/adminConfigure', JSON.stringify(payload), '--ctx', ctx];

const result = spawnSync('npx', args, { cwd: root, encoding: 'utf8', stdio: 'inherit' });

if (result.status !== 0) {
  fail('Deploy the latest code first (`npx tgcloud push`), then re-run `npm run set-key`.');
}

console.log('\n✔ Configuration pushed to the bot.');
console.log('  Verify in Telegram with:  /config');
console.log('  Test vision support with: /testmodel\n');
