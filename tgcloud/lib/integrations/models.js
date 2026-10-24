// integrations/models.js — list the models the configured provider actually
// exposes for the stored API key. Groq retires/renames models frequently, so
// the only reliable way to pick a valid model is to ask the API itself.

import { fetch } from 'sdk';
import { GROQ_DEFAULT_BASE_URL } from './providers/groq.js';
import { OPENAI_DEFAULT_BASE_URL } from './providers/openai.js';

const DEFAULT_BASE_URLS = {
  groq: GROQ_DEFAULT_BASE_URL,
  openai: OPENAI_DEFAULT_BASE_URL,
  openai_compatible: OPENAI_DEFAULT_BASE_URL,
};

/**
 * Fetch the list of active model ids from the provider's /models endpoint.
 */
export async function listModels(settings) {
  const provider = (settings.aiProvider || 'openai').toLowerCase();
  const base = (settings.aiBaseUrl || DEFAULT_BASE_URLS[provider] || OPENAI_DEFAULT_BASE_URL)
    .replace(/\/+$/, '');
  if (!settings.aiApiKey) {
    throw new Error('No AI provider key configured. Set it first with /setkey.');
  }

  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${settings.aiApiKey}` },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data && data.data) || [];
  return rows
    .map((m) => (typeof m === 'string' ? m : m && m.id))
    .filter((id) => id && id !== 'undefined')
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .sort();
}

/**
 * Heuristic: does this model id likely accept image input (vision)?
 * Used only to order the `/models` list; the authoritative signal is trying the
 * model with a real receipt.
 */
export function isLikelyVision(id) {
  return /vision|vl|llama-4|qwen3\.8|qwen3-vl|qwen2\.5-vl|multimodal|gemini|gpt-4o|4o-mini|pixtral|qwen-vl/i.test(id);
}
