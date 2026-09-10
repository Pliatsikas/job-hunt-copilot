import type { AnalysisResult } from "../lib/schemas/analysis";
import { normalizeForGrounding } from "../lib/llm/grounding";
import type { AnalysisFixture } from "../lib/schemas/eval";

/**
 * Distance *outside* the expected band, zero when inside. Not distance from a
 * midpoint: the fixture author committed to a range they consider fair, and a
 * score anywhere inside it is not an error to be averaged away. The cost of
 * this choice is that a lazily wide band reports success, which is why
 * evals/README.md says to write the range before running the model.
 */
export function scoreDeviation(actual: number, [min, max]: readonly [number, number]): number {
  if (actual < min) return min - actual;
  if (actual > max) return actual - max;
  return 0;
}

/**
 * True when `needle` appears in `haystack` as a whole token.
 *
 * Plain `includes` was wrong and inflated recall: "mongodb" contains "go", so
 * a fixture asking for Go scored a hit on an answer that never mentioned it.
 * Boundaries are Unicode-aware lookarounds rather than \b — the postings are
 * partly Greek, and \b is defined on ASCII word characters, which is the exact
 * bug that shipped in M5's fabrication detector under a green suite
 * (CLAUDE.md, code conventions).
 *
 * "#" and "+" count as part of a token, not as boundaries: without that, "C"
 * matches "C#" and "C++", which are three different languages.
 */
const TOKEN_CHAR = "[\\p{L}\\p{N}#+]";

function containsAsToken(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!${TOKEN_CHAR})${escaped}(?!${TOKEN_CHAR})`, "u").test(haystack);
}

/**
 * Skills the fixtures and the models name differently for the same thing.
 *
 * This is a table, not a looser regex, and deliberately so. The failures it
 * fixes are real — a fixture asking for `css3` was scored a miss when the
 * model answered `CSS`, and `accessibility` was a miss against `WCAG 2.2 AA`
 * — but the obvious fix, relaxing the matcher, is how `go` starts matching
 * `mongodb`. Every entry here is a judgement someone made once and wrote
 * down, reviewable in a diff. A regex that happened to cover these cases
 * would also cover cases nobody considered.
 *
 * Keys and values are normalized on lookup, so case and spacing do not matter.
 * Each group is a set of mutual equivalents.
 */
export const SKILL_ALIASES: readonly (readonly string[])[] = [
  ["css", "css3"],
  ["html", "html5"],
  ["accessibility", "a11y", "wcag", "wcag 2.1", "wcag 2.1 aa", "wcag 2.2", "wcag 2.2 aa"],
  ["javascript", "js", "es6", "ecmascript"],
  ["typescript", "ts"],
  ["node.js", "node", "nodejs"],
  ["postgresql", "postgres", "psql"],
  ["ci/cd", "ci", "cd", "ci/cd pipelines", "continuous integration"],
  ["rest api design", "rest", "rest apis", "restful apis"],
  ["llm integration", "llm integrations", "working with llms"],
  ["llm evaluation", "rag evaluation", "llm benchmarking", "model evaluation"],
  ["prisma orm", "prisma"],
  ["react native", "reactnative"],
  ["asp.net core", "asp.net"],
  ["sql server", "mssql", "microsoft sql server", "ms sql"],
];

const ALIAS_GROUPS = SKILL_ALIASES.map(
  (group) => new Set(group.map((s) => normalizeForGrounding(s))),
);

/** True when both names appear in the same declared equivalence group. */
function shareAliasGroup(a: string, b: string): boolean {
  return ALIAS_GROUPS.some((group) => group.has(a) && group.has(b));
}

/**
 * A skill counts as found if it appears in a matched skill's name — the model
 * may answer "React 18" or "react.js" for "react", and calling those a miss
 * would measure vocabulary rather than judgement. Checked in both directions,
 * on the same normalization the grounding check uses, plus the explicit alias
 * table above for names that share no substring at all.
 */
export function skillMatches(expected: string, produced: string): boolean {
  const a = normalizeForGrounding(expected);
  const b = normalizeForGrounding(produced);
  if (!a || !b) return false;
  if (a === b) return true;
  if (shareAliasGroup(a, b)) return true;
  // One direction only. The answer may be *more* specific than the fixture
  // asked for — "React 18" satisfies "react" — but never less: matching both
  // ways made "react" satisfy "react native", which is the exact distinction
  // the mobile fixture exists to test. Legitimate abbreviations in the other
  // direction ("Node" for "node.js") belong in the alias table, where each
  // one is a decision someone wrote down.
  return containsAsToken(b, a);
}

export function recall(expected: string[], produced: string[]): { found: string[]; missed: string[] } {
  const found: string[] = [];
  const missed: string[] = [];
  for (const skill of expected) {
    (produced.some((p) => skillMatches(skill, p)) ? found : missed).push(skill);
  }
  return { found, missed };
}

export type FixtureScore = {
  scoreDeviation: number;
  inRange: boolean;
  skillRecall: number;
  foundSkills: string[];
  missedSkills: string[];
  gapRecall: number | null;
  missedGaps: string[];
  /** v2's rule: a gap is one skill, so a long phrase means it regressed. */
  wordyGaps: string[];
};

/** A gap entry that reads as a requirement rather than a named skill. */
export function isWordyGap(skill: string): boolean {
  return /\d+\s*[-–+]?\s*\d*\s*(years|χρόνια)/i.test(skill) || skill.trim().split(/\s+/).length >= 5;
}

export function scoreFixture(fixture: AnalysisFixture, result: AnalysisResult): FixtureScore {
  const matched = result.matchedSkills.map((m) => m.skill);
  const skills = recall(fixture.mustFindSkills, matched);

  const gapNames = result.gaps.map((g) => g.skill);
  const gaps = fixture.mustFlagGaps.length ? recall(fixture.mustFlagGaps, gapNames) : null;

  return {
    scoreDeviation: scoreDeviation(result.matchScore, fixture.expectedScoreRange),
    inRange: scoreDeviation(result.matchScore, fixture.expectedScoreRange) === 0,
    skillRecall: fixture.mustFindSkills.length
      ? skills.found.length / fixture.mustFindSkills.length
      : 1,
    foundSkills: skills.found,
    missedSkills: skills.missed,
    gapRecall: gaps ? gaps.found.length / fixture.mustFlagGaps.length : null,
    missedGaps: gaps?.missed ?? [],
    wordyGaps: gapNames.filter(isWordyGap),
  };
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

/** Middle value; the mean of the two middles for an even count. */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** max - min. The observed noise floor for one fixture across runs. */
export function spread(values: number[]): number {
  if (!values.length) return 0;
  return Math.max(...values) - Math.min(...values);
}
