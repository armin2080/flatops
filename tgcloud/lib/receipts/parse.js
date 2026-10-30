// parse.js — extract a JSON object from a language model's text output.
// Models often wrap JSON in markdown fences, add prose, emit reasoning text, or
// truncate long responses. This tolerates all of those cases.

function tryParse(s) {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Try to parse model output into a plain object. Returns `null` if nothing
 * parseable is found.
 */
export function parseModelOutput(text) {
  if (text === null || text === undefined) return null;
  if (typeof text === 'object' && !Array.isArray(text)) return text;

  const s = String(text).trim();
  if (!s) return null;

  const candidates = [];

  // 1. The whole string, verbatim.
  candidates.push(s);

  // 2. Every fenced code block, in order.
  for (const f of s.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)) {
    if (f[1] && f[1].trim()) candidates.push(f[1].trim());
  }

  // 3. The outermost { ... } span (skips leading prose/reasoning).
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(s.slice(start, end + 1));

  for (const c of candidates) {
    const v = tryParse(c);
    if (v) return v;
  }

  // 4. Last resort: strip trailing commas (a common truncation/formatting slip),
  //    then retry the object span.
  const cleaned = s.replace(/,(\s*[}\]])/g, '$1');
  const cs = cleaned.indexOf('{');
  const ce = cleaned.lastIndexOf('}');
  if (cs !== -1 && ce > cs) {
    const v = tryParse(cleaned.slice(cs, ce + 1));
    if (v) return v;
  }

  return null;
}
