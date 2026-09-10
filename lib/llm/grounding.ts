import type { AnalysisResult, MatchedSkill, Severity } from "../schemas/analysis";

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
/**
 * Ceiling on gap entries, enforced here as well as asked for in the prompt.
 * analyze@2's "one skill per gap" rule multiplies list length — a bullet
 * naming four technologies becomes four entries — and long lists both crowd
 * out the entries that matter and risk overrunning the output budget.
 */
export const MAX_GAPS = 12;

/** Worst first. A gap that blocks the application outranks a nice-to-have. */
const SEVERITY_ORDER: Record<Severity, number> = {
  blocker: 0,
  important: 1,
  nice_to_have: 2,
};

/**
 * Order by severity, then truncate — never the other way round.
 *
 * The model is told to do this, and mostly does. Mostly is not enough: on the
 * DevOps fixture it produced exactly ten entries and `aws`, a genuine blocker,
 * was not among them, because trivia had already filled the list. Sorting in
 * code means the cap can only ever discard the least consequential entries.
 *
 * The sort is stable, so within one severity the model's own ordering — which
 * carries its sense of what matters most — is preserved.
 */
export function capGaps(gaps: AnalysisResult["gaps"], max = MAX_GAPS) {
  const ordered = [...gaps].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  return { gaps: ordered.slice(0, max), droppedGaps: Math.max(0, ordered.length - max) };
}

export function groundAnalysis(result: AnalysisResult, cvText: string) {
  const outcome = groundMatchedSkills(result.matchedSkills, cvText);
  const capped = capGaps(result.gaps);
  return {
    result: { ...result, matchedSkills: outcome.matchedSkills, gaps: capped.gaps },
    droppedClaims: outcome.droppedClaims,
    droppedGaps: capped.droppedGaps,
    lowConfidence: outcome.lowConfidence,
  };
}
