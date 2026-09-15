import { MIN_EVIDENCE_CHARS, normalizeForGrounding } from "../llm/grounding";

/**
 * Whether the imported text can be quoted from — which is the only success
 * criterion that matters (SPEC.md §6.2). A line the grounding check would
 * accept as evidence is at least MIN_EVIDENCE_CHARS after normalization; a
 * text made mostly of shorter lines has come out fragmented, and every
 * analysis against it will find "no evidence" for skills it plainly lists.
 */
export type ImportQuality = {
  lines: number;
  quotableLines: number;
  /** Share of lines the grounding check could accept as evidence. */
  quotableShare: number;
  /** True when the text looks fragmented enough that analyses will suffer. */
  fragmented: boolean;
};

export const FRAGMENTED_BELOW = 0.6;

export function assessImportQuality(lines: string[]): ImportQuality {
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  const quotable = nonEmpty.filter(
    (l) => normalizeForGrounding(l).length >= MIN_EVIDENCE_CHARS,
  ).length;
  const share = nonEmpty.length ? quotable / nonEmpty.length : 0;
  return {
    lines: nonEmpty.length,
    quotableLines: quotable,
    quotableShare: share,
    fragmented: nonEmpty.length > 0 && share < FRAGMENTED_BELOW,
  };
}
