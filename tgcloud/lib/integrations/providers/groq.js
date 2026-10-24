// providers/groq.js — Groq vision provider.
//
// Groq exposes an OpenAI-compatible chat completions endpoint. Two differences
// matter for receipt extraction:
//   - base URL is https://api.groq.com/openai/v1
//   - Groq's vision models do NOT support `response_format: { type: "json_object" }`,
//     so we omit it and rely on the prompt (which already demands bare JSON) and
//     the tolerant parser in receipts/parse.js.

import { buildExtractionMessages } from '../prompt.js';
import { callChatCompletion } from './openai.js';

export const GROQ_DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Groq adapter entry point.
 *
 * @param {Function} fetchImpl a fetch-like function.
 * @param {{aiApiKey:string, aiModel:string, aiBaseUrl?:string}} settings
 * @param {string} imageBase64 base64-encoded image bytes.
 * @param {string} mimeType image mime type (e.g. "image/jpeg").
 */
export async function extractReceiptText(fetchImpl, settings, imageBase64, mimeType) {
  const apiKey = settings.aiApiKey;
  if (!apiKey) {
    throw new Error('No AI provider key configured. Use /setkey from the admin account.');
  }
  const model = settings.aiModel || 'qwen/qwen3.8-27b';
  const baseUrl = (settings.aiBaseUrl || GROQ_DEFAULT_BASE_URL).replace(/\/+$/, '');

  const messages = buildExtractionMessages();
  messages[messages.length - 1].content.push({
    type: 'image_url',
    image_url: { url: `data:${mimeType};base64,${imageBase64}` },
  });

  return callChatCompletion(fetchImpl, { apiKey, model, baseUrl, messages, includeJsonMode: false });
}
