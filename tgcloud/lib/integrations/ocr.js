// ocr.js — the receipt extraction service.
//
// Orchestrates: encode image -> call the configured provider -> parse the JSON
// -> validate/normalise into a cents-based structure. Providers are swappable
// through `settings.aiProvider`. Built in: `openai` (OpenAI/Azure/OpenRouter/
// self-hosted) and `groq` (Groq's OpenAI-compatible endpoint).

import { fetch } from 'sdk';

import { bytesToBase64 } from './base64.js';
import { extractReceiptText as openaiExtract } from './providers/openai.js';
import { extractReceiptText as groqExtract } from './providers/groq.js';
import { parseModelOutput } from '../receipts/parse.js';
import { normalizeExtraction } from '../receipts/validate.js';

const PROVIDERS = {
  openai: openaiExtract,
  openai_compatible: openaiExtract,
  groq: groqExtract,
};

/**
 * Run the full extraction pipeline.
 *
 * @param {object} settings provider configuration (aiProvider, aiApiKey, aiModel, aiBaseUrl).
 * @param {Uint8Array} imageBytes raw image bytes.
 * @param {string} mimeType image mime type.
 * @returns a normalised extraction result (see validate.js).
 */
const REPAIR_INSTRUCTION = 'Your previous answer was not valid JSON. Respond with ONLY a single valid JSON object matching the requested schema. No reasoning, no thinking, no prose, no markdown. Start with "{" and end with "}".';

export async function extractReceipt(settings, imageBytes, mimeType) {
  const providerName = (settings.aiProvider || 'openai').toLowerCase();
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unknown AI provider "${providerName}". Supported: ${Object.keys(PROVIDERS).join(', ')}.`);
  }

  const imageBase64 = bytesToBase64(imageBytes);
  const mime = mimeType || 'image/jpeg';

  let rawText = await provider(fetch, settings, imageBase64, mime);
  let raw = parseModelOutput(rawText);

  if (!raw) {
    // The model produced prose/reasoning or truncated JSON. Retry once with an
    // explicit JSON-only instruction — the most reliable way to recover.
    try {
      rawText = await provider(fetch, settings, imageBase64, mime, REPAIR_INSTRUCTION);
      raw = parseModelOutput(rawText);
    } catch (err) {
      console.warn('repair extraction failed', err && err.message ? err.message : err);
    }
  }

  const result = normalizeExtraction(raw);
  if (!result.ok) {
    const snippet = String(rawText || '').replace(/\s+/g, ' ').slice(0, 240);
    throw new Error(`${result.errors?.[0] || 'Receipt extraction failed.'}${snippet ? ` Provider returned: "${snippet}"` : ''}`);
  }
  return result;
}
