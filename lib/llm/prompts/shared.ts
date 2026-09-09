import type { AnalysisResult, Gap } from "../../schemas/analysis";

export const LANGUAGES = ["en", "el"] as const;
export const TONES = ["direct", "warm", "formal"] as const;
export const LENGTHS = ["short", "standard"] as const;

export type Language = (typeof LANGUAGES)[number];
export type Tone = (typeof TONES)[number];
export type Length = (typeof LENGTHS)[number];

const SEVERITY_RANK: Record<Gap["severity"], number> = {
  blocker: 0,
  important: 1,
  nice_to_have: 2,
};

/** The gap worth addressing head-on: worst severity, first listed. */
export function topGap(analysis: AnalysisResult): Gap | null {
  const sorted = [...analysis.gaps].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
  return sorted[0] ?? null;
}

export const TONE_GUIDANCE: Record<Tone, string> = {
  direct: "Plain and economical. Short sentences. No throat-clearing, no flattery.",
  warm: "Human and personable, still professional. Some enthusiasm, no gushing.",
  formal: "Reserved and conventional. Full forms, measured register, no contractions.",
};

export const LENGTH_GUIDANCE: Record<Length, string> = {
  short: "At most 150 words. Three short paragraphs maximum.",
  standard: "200–300 words. Three or four paragraphs.",
};

/**
 * The instruction that matters most for Greek. A model asked for "Greek" will
 * happily emit English sentence structure with Greek words in it, which reads
 * as machine translation to any native speaker.
 */
export const LANGUAGE_GUIDANCE: Record<Language, string> = {
  en: "Write in English.",
  el: `Γράψε στα ελληνικά. Write natively idiomatic Greek — not English composed with Greek
words. Use Greek professional register and natural Greek sentence structure, which is not
English word order. Do not calque English business idiom ("I am reaching out", "I am excited
about the opportunity") — use what a Greek professional would actually write. Keep widely used
English technical terms (React, backend, deployment) as they are, because translating them
reads as stilted; inflect the surrounding Greek correctly around them.`,
};

/** Shared with every generation prompt — the honesty floor. */
export const GROUNDING_RULES = `Hard rules:
- Never claim experience the CV does not show. No invented projects, employers, years or
  technologies. If the CV does not support a claim, it does not go in.
- Do not exaggerate. "Familiar with" is not "expert in".
- Do not fabricate names, dates, salaries or mutual contacts.
- Write the body text only. No preamble, no commentary about what you produced, no
  markdown code fences around the whole thing.`;
