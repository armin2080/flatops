import { describe, it, expect } from 'vitest';
import { parseModelOutput } from '../../tgcloud/lib/receipts/parse.js';

describe('parseModelOutput', () => {
  it('parses plain JSON', () => {
    expect(parseModelOutput('{"store":"REWE"}')).toEqual({ store: 'REWE' });
  });

  it('parses JSON in a markdown fence', () => {
    const text = 'Here is the result:\n```json\n{"store":"EDEKA","total":"20,90"}\n```\nDone.';
    expect(parseModelOutput(text)).toEqual({ store: 'EDEKA', total: '20,90' });
  });

  it('extracts the outer object from prose', () => {
    const text = 'Sure! The receipt is {"store":"Aldi","items":[]}. Hope that helps.';
    expect(parseModelOutput(text)).toEqual({ store: 'Aldi', items: [] });
  });

  it('returns null for garbage', () => {
    expect(parseModelOutput('no json here')).toBeNull();
    expect(parseModelOutput(null)).toBeNull();
    expect(parseModelOutput('')).toBeNull();
  });

  it('extracts JSON embedded in leading reasoning text', () => {
    const text = 'Let me analyze the receipt. The structured result follows: {"store":"Netto","items":[{"original":"Milch"}]}';
    expect(parseModelOutput(text)).toEqual({ store: 'Netto', items: [{ original: 'Milch' }] });
  });

  it('repairs trailing commas', () => {
    const text = '{"store":"Netto","total":"46,38",}';
    expect(parseModelOutput(text)).toEqual({ store: 'Netto', total: '46,38' });
  });
});
