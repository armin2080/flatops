import { describe, it, expect, vi } from 'vitest';
import {
  extractReceiptText as academicExtract,
  ACADEMIC_CLOUD_DEFAULT_BASE_URL,
  ACADEMIC_CLOUD_DEFAULT_MODEL,
} from '../../tgcloud/lib/integrations/providers/academiccloud.js';

function fakeFetch(respond) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => respond,
    text: async () => JSON.stringify(respond),
  }));
}

const body = () => ({ choices: [{ message: { content: '{"store":"Netto"}' } }] });

describe('academic cloud adapter', () => {
  it('targets the Academic Cloud v1 gateway', async () => {
    const fn = fakeFetch(body());
    await academicExtract(fn, { aiApiKey: 'k' }, 'AAAA', 'image/jpeg');
    const [url] = fn.mock.calls[0];
    expect(url).toBe(`${ACADEMIC_CLOUD_DEFAULT_BASE_URL}/chat/completions`);
    expect(url).toContain('chat-ai.academiccloud.de');
  });

  it('defaults to the multimodal omni model', async () => {
    const fn = fakeFetch(body());
    await academicExtract(fn, { aiApiKey: 'k' }, 'AAAA', 'image/jpeg');
    const payload = JSON.parse(fn.mock.calls[0][1].body);
    expect(payload.model).toBe(ACADEMIC_CLOUD_DEFAULT_MODEL);
    expect(payload.model).toContain('omni');
  });

  it('allows a generous output budget (no Groq-style 1000 cap)', async () => {
    const fn = fakeFetch(body());
    await academicExtract(fn, { aiApiKey: 'k' }, 'AAAA', 'image/jpeg');
    const payload = JSON.parse(fn.mock.calls[0][1].body);
    expect(payload.max_tokens).toBe(4096);
    expect(payload.response_format).toBeUndefined();
  });

  it('sends the image as a data URL', async () => {
    const fn = fakeFetch(body());
    await academicExtract(fn, { aiApiKey: 'k' }, 'QUJD', 'image/png');
    const payload = JSON.parse(fn.mock.calls[0][1].body);
    const last = payload.messages[payload.messages.length - 1];
    const image = last.content.find((c) => c.type === 'image_url');
    expect(image.image_url.url).toBe('data:image/png;base64,QUJD');
  });

  it('honours an explicit model and base URL override', async () => {
    const fn = fakeFetch(body());
    await academicExtract(fn, { aiApiKey: 'k', aiModel: 'gemma-4-31b-it', aiBaseUrl: 'https://x.test/v1/' }, 'AAAA', 'image/jpeg');
    expect(fn.mock.calls[0][0]).toBe('https://x.test/v1/chat/completions');
    expect(JSON.parse(fn.mock.calls[0][1].body).model).toBe('gemma-4-31b-it');
  });
});
