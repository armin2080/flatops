// providers/academiccloud.js — Academic Cloud vision provider.
//
// Academic Cloud (https://chat-ai.academiccloud.de) exposes an
// OpenAI-compatible chat-completions API on a vLLM-style gateway.
//
// Notes that matter for receipt extraction:
//   - The base URL is fixed, so no /setbaseurl is needed.
//   - Unlike Groq's free tier there is no tiny output-token cap, so long
//     receipts (30+ lines) fit without truncation.
//   - Only multimodal models can read the photo. `qwen3-omni-30b-a3b-instruct`
//     is natively multimodal; most others in the catalogue are text-only.
//   - We do NOT request strict JSON mode (vLLM gateways vary in support); the
//     prompt demands bare JSON and ocr.js retries with a repair instruction.

import { buildExtractionMessages } from '../prompt.js';
import { callChatCompletion } from './openai.js';

export const ACADEMIC_CLOUD_DEFAULT_BASE_URL = 'https://chat-ai.academiccloud.de/v1';
export const ACADEMIC_CLOUD_DEFAULT_MODEL = 'qwen3-omni-30b-a3b-instruct';

/**
 * Academic Cloud adapter entry point.
 *
 * @param {Function} fetchImpl a fetch-like function.
 * @param {{aiApiKey:string, aiModel:string, aiBaseUrl?:string}} settings
 * @param {string} imageBase64 base64-encoded image bytes.
 * @param {string} mimeType image mime type (e.g. "image/jpeg").
 * @param {string} [extraInstruction] repair instruction for the retry pass.
 */
export async function extractReceiptText(fetchImpl, settings, imageBase64, mimeType, extraInstruction) {
  const apiKey = settings.aiApiKey;
  if (!apiKey) {
    throw new Error('No AI provider key configured. Use /setkey from the admin account.');
  }
  const model = settings.aiModel || ACADEMIC_CLOUD_DEFAULT_MODEL;
  const baseUrl = (settings.aiBaseUrl || ACADEMIC_CLOUD_DEFAULT_BASE_URL).replace(/\/+$/, '');

  const messages = buildExtractionMessages(extraInstruction);
  messages[messages.length - 1].content.push({
    type: 'image_url',
    image_url: { url: `data:${mimeType};base64,${imageBase64}` },
  });

  return callChatCompletion(fetchImpl, {
    apiKey,
    model,
    baseUrl,
    messages,
    includeJsonMode: false,
    maxTokens: 4096,
  });
}
