/**
 * A match score as a small pill. Colour follows the score band, but the number
 * is always printed: colour is reinforcement, never the only carrier.
 */
export function ScoreBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
        not scored
      </span>
    );
  }
  const tone =
    score >= 70
      ? "bg-score-high/15 text-score-high ring-score-high/30"
      : score >= 40
        ? "bg-score-mid/15 text-score-mid ring-score-mid/30"
        : "bg-score-low/15 text-score-low ring-score-low/30";
  const dims = size === "lg" ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-semibold tabular-nums ring-1 ring-inset ${tone} ${dims}`}
      aria-label={`Match score ${score} out of 100`}
    >
      {score}
    </span>
  );
}
