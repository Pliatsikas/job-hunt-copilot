import type { TailoredCv } from "../schemas/tailored-cv";
import { findFabricatedClaims } from "./fabrication";
import { normalizeForGrounding } from "./grounding";

/**
 * Exact-line grounding for the tailored CV.
 *
 * Stricter than the analysis's substring check on purpose. A quote in an
 * analysis is evidence for a claim the model is making; a line in a tailored
 * CV *is* the CV, presented as the candidate's own words. So a line is kept
 * only if it reproduces one of the CV's lines in full — the same
 * normalization (case, whitespace, dash and quote style) so a smart quote
 * does not count as an edit, and nothing looser. A half-sentence, a merged
 * pair, a tidied typo: all discarded and counted.
 */

export const CV_LINE_MIN_CHARS = 3;

export function cvLines(cvText: string): string[] {
  return cvText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= CV_LINE_MIN_CHARS);
}

export type TailorGrounding = {
  cv: TailoredCv;
  /** Lines the model returned that are not lines of the CV. Shown, not hidden. */
  droppedLines: string[];
  /** Lines the model returned more than once; only the first is kept. */
  duplicateLines: number;
  /** Sentences the fabrication detector flagged — should be 0 by construction. */
  fabrications: number;
  /** Share of the CV's lines that were used at all. */
  coverage: number;
};

export function groundTailoredCv(
  output: TailoredCv,
  cvText: string,
  absentSkills: string[],
): TailorGrounding {
  const original = cvLines(cvText);
  // Normalized line → the original, so what is saved is the CV's own text
  // rather than the model's copy of it, even where the copy was accepted.
  const byNormalized = new Map<string, string>();
  for (const line of original) {
    const key = normalizeForGrounding(line);
    if (!byNormalized.has(key)) byNormalized.set(key, line);
  }

  const droppedLines: string[] = [];
  const used = new Set<string>();
  let duplicateLines = 0;

  const sections = output.sections
    .map((section) => {
      const lines: string[] = [];
      for (const candidate of section.lines) {
        const key = normalizeForGrounding(candidate);
        const match = byNormalized.get(key);
        if (!match) {
          droppedLines.push(candidate);
          continue;
        }
        if (used.has(key)) {
          duplicateLines += 1;
          continue;
        }
        used.add(key);
        lines.push(match);
      }
      return { heading: section.heading, lines };
    })
    .filter((section) => section.lines.length > 0);

  const text = sections.flatMap((s) => s.lines).join("\n");
  // By construction every kept line is the CV's own, so this can only fire
  // if the CV itself claims an absent skill. Cheap, and SPEC.md §6.3 asks
  // for the M5 detector to be extended here rather than assumed.
  const fabrications = findFabricatedClaims(text, absentSkills).length;

  return {
    cv: { sections, keywordsAddressed: output.keywordsAddressed },
    droppedLines,
    duplicateLines,
    fabrications,
    coverage: original.length ? used.size / original.length : 0,
  };
}

const HEADING_LABEL: Record<TailoredCv["sections"][number]["heading"], string> = {
  PROFILE: "Profile",
  EXPERIENCE: "Experience",
  PROJECTS: "Projects",
  SKILLS: "Skills",
  EDUCATION: "Education",
  LANGUAGES: "Languages",
  CERTIFICATIONS: "Certifications",
  OTHER: "Other",
};

/** What gets stored as Document.content — plain text, one line per row. */
export function renderTailoredCv(cv: TailoredCv): string {
  return cv.sections
    .map((s) => `${HEADING_LABEL[s.heading].toUpperCase()}\n${s.lines.join("\n")}`)
    .join("\n\n");
}
