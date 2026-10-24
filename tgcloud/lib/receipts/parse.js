// parse.js — extract a JSON object from a language model's text output.
// Models often wrap JSON in markdown fences or add prose; this tolerates that.

/**
 * Try to parse model output into a plain object. Returns `null` if nothing
 * parseable is found.
 */
export function parseModelOutput(text) {
  if (text === null || text === undefined) return null;
  if (typeof text === 'object') return text;

  const s = String(text).trim();
  if (!s) return null;

  // Direct JSON.
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object') return v;
  } catch {
    /* ignore */
  }

  let candidate = s;

  // Strip a ```json ... ``` fence if present.
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();

  // Fall back to the outermost { ... } span.
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
    try {
      const v = JSON.parse(candidate);
      if (v && typeof v === 'object') return v;
    } catch {
      /* ignore */
    }
  }

  return null;
}
