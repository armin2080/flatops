// prompt.js — the system/user prompts for receipt extraction. The model is
// instructed to return ONLY JSON, in a fixed schema, following the recognition
// rules required by FlatOps.

const SYSTEM_PROMPT = `You are a precise German supermarket receipt extraction engine.

Read the receipt image and return a single JSON object — nothing else. No prose, no markdown fences, no reasoning or chain-of-thought. Output the JSON directly as your entire response.

Follow these rules strictly:
1. Preserve the ORIGINAL German product description exactly as printed in "original". Never replace it with a translation.
2. Provide a natural, readable English translation in "english" (not a word-for-word literal).
3. Extract quantity and unit separately (e.g. quantity "0.5", unit "kg").
4. Distinguish "unit_price" (price per single unit) from "line_total" (total charged for this line). If only one is printed, use it for "line_total" and leave "unit_price" as null.
5. Keep every printed line as its own item. Do NOT merge identical-looking products.
6. Report money as strings exactly as printed, using a decimal comma where the receipt uses one (e.g. "2,49"). Do not convert to another format.
7. Set "confidence" from 0.0 to 1.0 for each item. Use a low value (e.g. 0.3) for anything you are unsure about, and null only if you have no signal at all.
8. Do NOT invent products, quantities, prices, or dates. If something is unreadable, omit it or mark it with low confidence.
9. Treat discounts (Rabatt), refundable deposits (Pfand), and other receipt-level charges as entries in "adjustments" with a "kind" of "discount", "pfand", or "refund", and a signed "amount" (negative for discounts/refunds). Do not treat them as products.
10. Use "total" for the receipt's printed grand total.

Return JSON with exactly this shape:
{
  "store": string,
  "date": "YYYY-MM-DD" or null,
  "currency": "EUR",
  "total": string,
  "items": [
    {
      "original": string,
      "english": string,
      "quantity": string | null,
      "unit": string | null,
      "unit_price": string | null,
      "line_total": string,
      "confidence": number
    }
  ],
  "adjustments": [
    { "kind": "discount" | "pfand" | "refund", "label": string, "amount": string }
  ]
}`;

/**
 * Build the extraction messages. An optional `extraInstruction` is appended to
 * the user text (used by the repair retry to demand strict JSON).
 */
export function buildExtractionMessages(extraInstruction) {
  const text = extraInstruction
    ? `Extract this supermarket receipt into the JSON structure described.\n\n${extraInstruction}`
    : 'Extract this supermarket receipt into the JSON structure described.';
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: [{ type: 'text', text }] },
  ];
}
