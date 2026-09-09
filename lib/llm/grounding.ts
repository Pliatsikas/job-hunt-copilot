import type { AnalysisResult, MatchedSkill } from "../schemas/analysis";

/** A bare skill name is not evidence. Measured after normalization. */
export const MIN_EVIDENCE_CHARS = 15;

const SMART_SINGLE = /[‘’‚‛′‵]/g;
const SMART_DOUBLE = /[“”„‟″‶]/g;
const DASHES = /[‐‑‒–—―]/g;
const TRAILING_PUNCTUATION = /[.,;:!?'"\)\]\}\s]+$/;
const LEADING_PUNCTUATION = /^[\s'"\(\[\{]+/;

/**
 * Both sides go through this before comparison, so a quote that differs from
 * the CV only in curly quotes, dash style or whitespace still counts as real.
 */
export function normalizeForGrounding(text: string): string {
  return text
    .toLowerCase()
    .replace(SMART_SINGLE, "'")
    .replace(SMART_DOUBLE, '"')
    .replace(DASHES, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEvidence(text: string): string {
  return normalizeForGrounding(text)
    .replace(LEADING_PUNCTUATION, "")
    .replace(TRAILING_PUNCTUATION, "");
}

export type GroundingOutcome = {
  matchedSkills: MatchedSkill[];
  droppedClaims: number;
  /** Every claimed match failed grounding — the result must not read as normal. */
  lowConfidence: boolean;
};

/**
 * Drops matchedSkills whose evidence isn't actually in the CV. Silent by
 * design: this is a content decision, not a malformed response, so it never
 * triggers the repair loop (SPEC.md §8 Α3).
 */
export function groundMatchedSkills(
  matchedSkills: MatchedSkill[],
  cvText: string,
): GroundingOutcome {
  const haystack = normalizeForGrounding(cvText);

  const kept = matchedSkills.filter((entry) => {
    const needle = normalizeEvidence(entry.evidenceFromCv);
    if (needle.length < MIN_EVIDENCE_CHARS) return false;
    return haystack.includes(needle);
  });

  const droppedClaims = matchedSkills.length - kept.length;

  return {
    matchedSkills: kept,
    droppedClaims,
    lowConfidence: matchedSkills.length > 0 && kept.length === 0,
  };
}

/** Applies grounding to a parsed result, returning the cleaned result. */
export function groundAnalysis(result: AnalysisResult, cvText: string) {
  const outcome = groundMatchedSkills(result.matchedSkills, cvText);
  return {
    result: { ...result, matchedSkills: outcome.matchedSkills },
    droppedClaims: outcome.droppedClaims,
    lowConfidence: outcome.lowConfidence,
  };
}
