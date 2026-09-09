import { analysisResultSchema, type AnalysisResult, type Severity } from "@/lib/schemas/analysis";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const VERDICT_LABELS: Record<AnalysisResult["verdict"], string> = {
  strong_fit: "Strong fit",
  worth_applying: "Worth applying",
  stretch: "A stretch",
  skip: "Probably skip",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  blocker: "Blockers",
  important: "Important",
  nice_to_have: "Nice to have",
};

const SEVERITY_ORDER: Severity[] = ["blocker", "important", "nice_to_have"];

const SEVERITY_VARIANTS: Record<Severity, "destructive" | "secondary" | "outline"> = {
  blocker: "destructive",
  important: "secondary",
  nice_to_have: "outline",
};

type AnalysisRow = {
  id: string;
  provider: string;
  model: string;
  promptVersion: string;
  matchScore: number;
  result: unknown;
  droppedClaims: number;
  latencyMs: number | null;
  createdAt: Date;
};

export function AnalysisView({ analysis }: { analysis: AnalysisRow }) {
  // The row is Json in Postgres — re-validate rather than trusting the column.
  const parsed = analysisResultSchema.safeParse(analysis.result);

  if (!parsed.success) {
    return (
      <p className="text-sm text-destructive">
        This analysis was stored in a format the app no longer understands. Re-run it.
      </p>
    );
  }

  const result = parsed.data;
  // Everything the model claimed was discarded — say so instead of showing a
  // confident-looking result built on nothing (SPEC.md §8 Α3).
  const lowConfidence = result.matchedSkills.length === 0 && analysis.droppedClaims > 0;

  return (
    <div className="flex flex-col gap-6">
      {lowConfidence && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Low confidence</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every skill the model claimed to match was discarded — none of its quotes appear
            in your CV. Your CV text is most likely too thin for this posting. Treat the score
            below as unreliable and add more detail on the profile page.
          </p>
        </div>
      )}

      <ScoreMeter score={result.matchScore} verdict={result.verdict} />

      <p className="text-sm leading-relaxed">{result.summary}</p>

      <Section title="Matched skills" count={result.matchedSkills.length}>
        {result.matchedSkills.length === 0 ? (
          <Empty>Nothing matched with evidence from your CV.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {result.matchedSkills.map((match, i) => (
              <li key={`${match.skill}-${i}`} className="text-sm">
                <div className="font-medium">{match.skill}</div>
                <blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground italic">
                  “{match.evidenceFromCv}”
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Gaps" count={result.gaps.length}>
        {result.gaps.length === 0 ? (
          <Empty>No gaps identified.</Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {SEVERITY_ORDER.map((severity) => {
              const gaps = result.gaps.filter((gap) => gap.severity === severity);
              if (gaps.length === 0) return null;
              return (
                <div key={severity}>
                  <Badge variant={SEVERITY_VARIANTS[severity]}>
                    {SEVERITY_LABELS[severity]}
                  </Badge>
                  <ul className="mt-2 flex flex-col gap-2">
                    {gaps.map((gap, i) => (
                      <li key={`${gap.skill}-${i}`} className="text-sm">
                        <span className="font-medium">{gap.skill}</span>
                        <span className="text-muted-foreground"> — {gap.howToBridge}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Keywords to mirror" count={result.keywordsToMirror.length}>
        {result.keywordsToMirror.length === 0 ? (
          <Empty>None suggested.</Empty>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {result.keywordsToMirror.map((keyword) => (
              <Badge key={keyword} variant="outline">
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      {result.redFlags.length > 0 && (
        <Section title="Red flags" count={result.redFlags.length}>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            {result.redFlags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        </Section>
      )}

      {result.likelyQuestions.length > 0 && (
        <Section title="Likely questions" count={result.likelyQuestions.length}>
          <ul className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
            {result.likelyQuestions.map((question, i) => (
              <li key={i}>{question}</li>
            ))}
          </ul>
        </Section>
      )}

      <footer className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>{formatDateTime(analysis.createdAt)}</span>
        <span>
          {analysis.provider}/{analysis.model}
        </span>
        <span>{analysis.promptVersion}</span>
        {analysis.latencyMs !== null && <span>{(analysis.latencyMs / 1000).toFixed(1)}s</span>}
        {analysis.droppedClaims > 0 && (
          <span>
            {analysis.droppedClaims} claim{analysis.droppedClaims === 1 ? "" : "s"} discarded —
            not found in your CV
          </span>
        )}
      </footer>
    </div>
  );
}

function ScoreMeter({ score, verdict }: { score: number; verdict: AnalysisResult["verdict"] }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-3xl font-semibold tabular-nums">{score}</span>
        <Badge variant={score >= 60 ? "default" : "secondary"}>{VERDICT_LABELS[verdict]}</Badge>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Match score"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">
        {title} <span className="text-muted-foreground">({count})</span>
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
