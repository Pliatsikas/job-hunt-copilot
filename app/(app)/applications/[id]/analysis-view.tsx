import { analysisResultSchema, type AnalysisResult, type Severity } from "@/lib/schemas/analysis";
import type { T } from "@/lib/i18n/t";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

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

/**
 * The result, in the order a person reads it: score and verdict, one
 * paragraph, what they have, what they lack. Keywords, red flags and the
 * questions are there but folded — they matter once the letter is being
 * written, not on first sight.
 */
export function AnalysisView({ analysis, t, compact = false }: { analysis: AnalysisRow; t: T; compact?: boolean }) {
  // The row is Json in Postgres — re-validate rather than trusting the column.
  const parsed = analysisResultSchema.safeParse(analysis.result);

  if (!parsed.success) {
    return <p className="text-sm text-destructive">{t("application.storedFormatOld")}</p>;
  }

  const result = parsed.data;
  // Everything the model claimed was discarded — say so instead of showing a
  // confident-looking result built on nothing (SPEC.md §8 Α3).
  const lowConfidence = result.matchedSkills.length === 0 && analysis.droppedClaims > 0;

  return (
    <div className="flex flex-col gap-6">
      {lowConfidence && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{t("application.lowConfidence")}</p>
        </div>
      )}

      <ScoreMeter score={result.matchScore} verdict={result.verdict} t={t} />

      <p className="text-sm leading-relaxed">{result.summary}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title={t("application.youHave")} count={result.matchedSkills.length} tone="good">
          {result.matchedSkills.length === 0 ? (
            <Empty>{t("application.matchedNone")}</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {result.matchedSkills.map((match, i) => (
                <li key={`${match.skill}-${i}`} className="text-sm">
                  <div className="font-medium">{match.skill}</div>
                  <blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground italic">“{match.evidenceFromCv}”</blockquote>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("application.youLack")} count={result.gaps.length} tone="bad">
          {result.gaps.length === 0 ? (
            <Empty>{t("application.noGaps")}</Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {SEVERITY_ORDER.map((severity) => {
                const gaps = result.gaps.filter((gap) => gap.severity === severity);
                if (gaps.length === 0) return null;
                return (
                  <div key={severity}>
                    <Badge variant={SEVERITY_VARIANTS[severity]}>{t(`application.severity.${severity}`)}</Badge>
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
      </div>

      {!compact && (
        <div className="flex flex-col gap-3">
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {t("application.keywords")} <span className="text-muted-foreground">({result.keywordsToMirror.length})</span>
            </summary>
            {result.keywordsToMirror.length === 0 ? (
              <Empty>{t("application.keywordsNone")}</Empty>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.keywordsToMirror.map((keyword) => (
                  <Badge key={keyword} variant="outline">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}
          </details>

          {result.redFlags.length > 0 && (
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t("application.redFlags")} <span className="text-muted-foreground">({result.redFlags.length})</span>
              </summary>
              <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
                {result.redFlags.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </details>
          )}

          {result.likelyQuestions.length > 0 && (
            <details id="questions" className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">{t("application.interviewQuestions", { count: result.likelyQuestions.length })}</summary>
              <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
                {result.likelyQuestions.map((question, i) => (
                  <li key={i}>{question}</li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}

      <footer className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>{formatDateTime(analysis.createdAt)}</span>
        <span>
          {analysis.provider}/{analysis.model}
        </span>
        <span>{analysis.promptVersion}</span>
        {analysis.latencyMs !== null && <span>{(analysis.latencyMs / 1000).toFixed(1)}s</span>}
        {analysis.droppedClaims > 0 && <span>{t("application.claimsDiscarded", { count: analysis.droppedClaims })}</span>}
      </footer>
    </div>
  );
}

function ScoreMeter({ score, verdict, t }: { score: number; verdict: AnalysisResult["verdict"]; t: T }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-4xl font-semibold tabular-nums">
          {score}
          <span className="text-base font-normal text-muted-foreground">/100</span>
        </span>
        <Badge variant={score >= 60 ? "default" : "secondary"}>{t(`application.verdict.${verdict}`)}</Badge>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("application.scoreLabel")}
      >
        <div className="animate-meter h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function Section({ title, count, tone, children }: { title: string; count: number; tone: "good" | "bad"; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border p-4 ${tone === "good" ? "border-primary/30 bg-primary/5" : "border-destructive/20 bg-destructive/5"}`}>
      <h3 className="mb-3 text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">({count})</span>
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
