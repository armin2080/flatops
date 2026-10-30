// providers/openai.js — OpenAI-compatible vision provider.
//
// Works with OpenAI, Azure OpenAI (set a custom base_url), OpenRouter, and many
// self-hosted vLLM/Ollama-compatible endpoints. `fetchImpl` is injected so this
// module stays free of `sdk` imports and remains unit-testable.

import { buildExtractionMessages } from '../prompt.js';

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * Low-level OpenAI-compatible chat completion. Shared by the OpenAI and Groq
 * adapters; `includeJsonMode` toggles `response_format: { type: "json_object" }`,
 * which some providers (e.g. Groq's vision models) do not support.
 */
export async function callChatCompletion(fetchImpl, {
  apiKey, model, baseUrl, messages, includeJsonMode, maxCompletionTokens,
}) {
  if (!apiKey) {
    throw new Error('No AI provider key configured. Use /setkey from the admin account.');
  }

  const body = { model, messages, temperature: 0 };
  if (includeJsonMode) body.response_format = { type: 'json_object' };
  if (maxCompletionTokens) body.max_completion_tokens = maxCompletionTokens;

  let res;
  try {
    res = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`AI provider request failed: ${err && err.message ? err.message : err}`);
  }

  if (!res || !res.ok) {
    let detail = '';
    try {
      const text = await res.text();
      detail = text ? text.slice(0, 300) : '';
    } catch {
      /* ignore */
    }
    throw new Error(`AI provider returned HTTP ${res ? res.status : 'unknown'}${detail ? `: ${detail}` : ''}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI provider returned an empty response.');
  }
  return content;
}

/**
 * OpenAI adapter entry point: builds the vision request and delegates to the
 * shared chat completion. Uses strict JSON mode.
 *
 * @param {Function} fetchImpl a fetch-like function.
 * @param {{aiApiKey:string, aiModel:string, aiBaseUrl?:string}} settings
 * @param {string} imageBase64 base64-encoded image bytes.
 * @param {string} mimeType image mime type (e.g. "image/jpeg").
 */
export async function extractReceiptText(fetchImpl, settings, imageBase64, mimeType, extraInstruction) {
  const apiKey = settings.aiApiKey;
  const model = settings.aiModel || 'gpt-4o-mini';
  const baseUrl = (settings.aiBaseUrl || OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, '');

  const messages = buildExtractionMessages(extraInstruction);
  messages[messages.length - 1].content.push({
    type: 'image_url',
    image_url: { url: `data:${mimeType};base64,${imageBase64}` },
  });

  return callChatCompletion(fetchImpl, { apiKey, model, baseUrl, messages, includeJsonMode: true });
}
