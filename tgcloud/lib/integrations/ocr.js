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
export async function extractReceipt(settings, imageBytes, mimeType) {
  const providerName = (settings.aiProvider || 'openai').toLowerCase();
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unknown AI provider "${providerName}". Supported: ${Object.keys(PROVIDERS).join(', ')}.`);
  }

  const imageBase64 = bytesToBase64(imageBytes);
  const rawText = await provider(fetch, settings, imageBase64, mimeType || 'image/jpeg');

  const raw = parseModelOutput(rawText);
  const result = normalizeExtraction(raw);
  if (!result.ok) {
    throw new Error(result.errors?.[0] || 'Receipt extraction failed.');
  }
  return result;
}
