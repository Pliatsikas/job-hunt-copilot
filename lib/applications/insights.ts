import { requireUser } from "../auth";
import { db } from "../db";
import type { Severity } from "../schemas/analysis";

/** Below this, the charts would describe noise rather than a pattern. */
export const MIN_ANALYSES_FOR_INSIGHTS = 5;

export type MissingSkill = {
  skill: string;
  severity: Severity;
  count: number;
};

export type ScorePoint = {
  month: string; // YYYY-MM
  averageScore: number;
  analyses: number;
};

export type SourceStat = {
  source: string;
  averageScore: number;
  applications: number;
};

export type Insights = {
  totalAnalyses: number;
  analysedApplications: number;
  missingSkills: MissingSkill[];
  scoreTrend: ScorePoint[];
  sources: SourceStat[];
  headline: string | null;
};

/**
 * Every aggregate is computed in Postgres. The gaps live inside a jsonb column,
 * so they are unnested with jsonb_array_elements rather than pulled into JS —
 * a user with 200 analyses should not ship 200 result blobs to the server just
 * to count skills.
 *
 * Each query counts an application once, via its most recent analysis. Without
 * DISTINCT ON, re-running the analysis on one posting would inflate its gaps
 * and make a single re-checked application look like a trend.
 */
export async function getInsights(): Promise<Insights> {
  const user = await requireUser();
  return computeInsights(user.id);
}

/**
 * Split from the session lookup so the aggregation can be run against real data
 * outside a request. `userId` is a required parameter rather than an optional
 * filter: there is no way to call this and accidentally aggregate the whole
 * table. The UI only ever reaches it through `getInsights()`.
 */
export async function computeInsights(userId: string): Promise<Insights> {
  const [counts, missingSkills, scoreTrend, sources] = await Promise.all([
    db.$queryRaw<{ total: number; applications: number }[]>`
      SELECT COUNT(*)::int AS total,
             COUNT(DISTINCT "applicationId")::int AS applications
      FROM "Analysis"
      WHERE "userId" = ${userId}
    `,

    db.$queryRaw<{ skill: string; severity: Severity; count: number }[]>`
      WITH latest AS (
        SELECT DISTINCT ON ("applicationId") "applicationId", "result"
        FROM "Analysis"
        WHERE "userId" = ${userId}
        ORDER BY "applicationId", "createdAt" DESC
      )
      SELECT lower(gap->>'skill') AS skill,
             gap->>'severity'     AS severity,
             COUNT(*)::int        AS count
      FROM latest, LATERAL jsonb_array_elements(latest."result"->'gaps') AS gap
      WHERE gap->>'skill' IS NOT NULL
      GROUP BY 1, 2
      ORDER BY count DESC, skill ASC
      LIMIT 12
    `,

    // Every analysis counts here, at the month it ran: this is the record of
    // what the scores looked like over time, not a per-application summary.
    db.$queryRaw<{ month: string; average: number; analyses: number }[]>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
             ROUND(AVG("matchScore"))::int                        AS average,
             COUNT(*)::int                                        AS analyses
      FROM "Analysis"
      WHERE "userId" = ${userId}
      GROUP BY 1
      ORDER BY 1 ASC
    `,

    // `source` is free text, and in practice it gets pasted as the full job-ad
    // URL. Grouping on the raw value put every application in its own group of
    // one and made the ranking meaningless, so a URL collapses to its host
    // (jobfind.gr) while anything hand-typed ("referral") is grouped verbatim.
    // The scheme is optional in the test: a pasted "linkedin.com/jobs/456" is
    // the same source as "https://www.linkedin.com/jobs/123" and must not
    // become a second group.
    db.$queryRaw<{ source: string; average: number; applications: number }[]>`
      SELECT CASE
               WHEN "source" ~* '^(https?://)?(www\.)?([a-z0-9-]+\.)+[a-z]{2,}([/:?#]|$)'
               THEN lower(substring("source" from '^(?:https?://)?(?:www\.)?([^/:?#]+)'))
               ELSE "source"
             END                                AS source,
             ROUND(AVG("latestMatchScore"))::int AS average,
             COUNT(*)::int                       AS applications
      FROM "Application"
      WHERE "userId" = ${userId}
        AND "archivedAt" IS NULL
        AND "source" IS NOT NULL
        AND "latestMatchScore" IS NOT NULL
      GROUP BY 1
      ORDER BY average DESC, applications DESC
    `,
  ]);

  const totalAnalyses = counts[0]?.total ?? 0;
  const analysedApplications = counts[0]?.applications ?? 0;

  const skills = missingSkills.map((row) => ({
    skill: row.skill,
    severity: row.severity,
    count: Number(row.count),
  }));
  const trend = scoreTrend.map((row) => ({
    month: row.month,
    averageScore: Number(row.average),
    analyses: Number(row.analyses),
  }));
  const sourceStats = sources.map((row) => ({
    source: row.source,
    averageScore: Number(row.average),
    applications: Number(row.applications),
  }));

  return {
    totalAnalyses,
    analysedApplications,
    missingSkills: skills,
    scoreTrend: trend,
    sources: sourceStats,
    headline: buildHeadline({
      totalAnalyses,
      analysedApplications,
      missingSkills: skills,
      scoreTrend: trend,
      sources: sourceStats,
    }),
  };
}

/**
 * One sentence describing the pattern, assembled from the aggregates. Not an
 * LLM call: it must be reproducible, instant, and cost nothing — and there is
 * no judgement here a model would do better than arithmetic.
 */
export function buildHeadline(input: {
  totalAnalyses: number;
  analysedApplications: number;
  missingSkills: MissingSkill[];
  scoreTrend: ScorePoint[];
  sources: SourceStat[];
}): string | null {
  if (input.totalAnalyses < MIN_ANALYSES_FOR_INSIGHTS) return null;

  const parts: string[] = [];

  const blockers = input.missingSkills.filter((s) => s.severity === "blocker");
  const top = (blockers.length ? blockers : input.missingSkills)[0];
  if (top) {
    const label = blockers.length ? "blocking gap" : "most common gap";
    // Counted per application, not per analysis — re-running the analysis on one
    // posting must not change the denominator under the reader.
    parts.push(
      `Your ${label} is ${top.skill}, missing from ${top.count} of ${input.analysedApplications} analysed roles`,
    );
  }

  if (input.scoreTrend.length >= 2) {
    const first = input.scoreTrend[0];
    const last = input.scoreTrend[input.scoreTrend.length - 1];
    const delta = last.averageScore - first.averageScore;
    if (Math.abs(delta) >= 5) {
      parts.push(
        `your average match has ${delta > 0 ? "risen" : "fallen"} ${Math.abs(delta)} points since ${first.month}`,
      );
    } else {
      parts.push(`your average match has held steady around ${last.averageScore}`);
    }
  }

  const best = input.sources[0];
  if (best && input.sources.length >= 2) {
    parts.push(`and ${best.source} is producing your strongest matches (${best.averageScore} average)`);
  }

  if (parts.length === 0) return null;
  return `${parts.join(", ")}.`;
}
