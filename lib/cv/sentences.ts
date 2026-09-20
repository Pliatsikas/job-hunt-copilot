/**
 * The CV text as numbered sentences. The extraction prompt shows them as
 * "S12| …" and the model cites "S12" (or "S12,S13") as a bullet's source —
 * a handful of characters instead of a copied sentence, which keeps the
 * answer inside Groq's 8 000-tokens-per-minute ceiling.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function numberedSentences(sentences: string[]): string {
  return sentences.map((s, i) => `S${i + 1}| ${s}`).join("\n");
}

const REF = /^S(\d+)(?:\s*,\s*S(\d+))?$/u;

/** The sentences a "S12" / "S12,S13" reference points at; null if malformed or out of range. */
export function resolveSource(ref: string, sentences: string[]): string | null {
  const m = ref.trim().match(REF);
  if (!m) return null;
  const picked = [m[1], m[2]].filter(Boolean).map((n) => sentences[Number(n) - 1]);
  if (picked.some((s) => s === undefined)) return null;
  return picked.join(" ");
}
