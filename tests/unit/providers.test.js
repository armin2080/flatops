import { describe, it, expect, vi } from 'vitest';
import { extractReceiptText as openaiExtract } from '../../tgcloud/lib/integrations/providers/openai.js';
import { extractReceiptText as groqExtract } from '../../tgcloud/lib/integrations/providers/groq.js';

function fakeFetch(respond) {
  return vi.fn(async (url, init) => {
    return {
      ok: true,
      status: 200,
      json: async () => respond,
      text: async () => JSON.stringify(respond),
    };
  });
}

const settings = { aiApiKey: 'test-key', aiModel: 'some-model', aiBaseUrl: undefined };
const body = () => ({ choices: [{ message: { content: '{"store":"X"}' } }] });

describe('provider adapters', () => {
  it('OpenAI adapter sends strict JSON mode', async () => {
    const fn = fakeFetch(body());
    await openaiExtract(fn, settings, 'AAAA', 'image/jpeg');
    const [url, init] = fn.mock.calls[0];
    expect(url).toContain('https://api.openai.com/v1/chat/completions');
    const payload = JSON.parse(init.body);
    expect(payload.response_format).toEqual({ type: 'json_object' });
  });

  it('Groq adapter uses the Groq base URL and omits JSON mode', async () => {
    const fn = fakeFetch(body());
    await groqExtract(fn, settings, 'AAAA', 'image/jpeg');
    const [url, init] = fn.mock.calls[0];
    expect(url).toContain('https://api.groq.com/openai/v1/chat/completions');
    const payload = JSON.parse(init.body);
    expect(payload.response_format).toBeUndefined();
    expect(payload.max_completion_tokens).toBe(16384);
  });

  it('Groq adapter appends a repair instruction when passed', async () => {
    const fn = fakeFetch(body());
    await groqExtract(fn, settings, 'AAAA', 'image/jpeg', 'Return only JSON.');
    const [, init] = fn.mock.calls[0];
    const payload = JSON.parse(init.body);
    const last = payload.messages[payload.messages.length - 1];
    const text = last.content.find((c) => c.type === 'text');
    expect(text.text).toContain('Return only JSON.');
  });

  it('Groq adapter attaches the image as a data URL', async () => {
    const fn = fakeFetch(body());
    await groqExtract(fn, settings, 'QUJD', 'image/png');
    const [, init] = fn.mock.calls[0];
    const payload = JSON.parse(init.body);
    const last = payload.messages[payload.messages.length - 1];
    const image = last.content.find((c) => c.type === 'image_url');
    expect(image.image_url.url).toContain('data:image/png;base64,QUJD');
  });
});
