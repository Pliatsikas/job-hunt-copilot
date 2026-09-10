import type { Metadata } from "next";
import Link from "next/link";
import { getInsights, MIN_ANALYSES_FOR_INSIGHTS } from "@/lib/applications/insights";
import { GapBarChart } from "@/components/gap-bar-chart";
import { ScoreTrendChart } from "@/components/score-trend-chart";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Patterns across your analyses — recurring skill gaps, how your match score is moving, and which sources are worth your time.",
};

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const insights = await getInsights();

  if (insights.totalAnalyses < MIN_ANALYSES_FOR_INSIGHTS) {
    return <ColdStart total={insights.totalAnalyses} />;
  }

  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Insights</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Across {insights.totalAnalyses} analyses of {insights.analysedApplications}{" "}
        {insights.analysedApplications === 1 ? "application" : "applications"}.
      </p>

      {insights.headline && (
        <p className="mt-4 max-w-3xl rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
          {insights.headline}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Most requested skills you don&apos;t have</CardTitle>
            <p className="text-sm text-muted-foreground">
              Counted once per application, from its most recent analysis.
            </p>
          </CardHeader>
          <CardContent>
            {insights.missingSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No gaps recorded yet — every analysed role matched what you have.
              </p>
            ) : (
              <GapBarChart skills={insights.missingSkills} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average match score by month</CardTitle>
            <p className="text-sm text-muted-foreground">
              Every analysis, at the month it ran.
            </p>
          </CardHeader>
          <CardContent>
            {insights.scoreTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to plot yet.</p>
            ) : (
              <ScoreTrendChart points={insights.scoreTrend} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where your best matches come from</CardTitle>
            <p className="text-sm text-muted-foreground">
              Average score of analysed applications, by source.
            </p>
          </CardHeader>
          <CardContent>
            {insights.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sources recorded yet. Set the source field on an application and this fills
                in.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {insights.sources.map((source) => (
                  <li
                    key={source.source}
                    className="flex items-center justify-between gap-4 border-b pb-2 text-sm last:border-0"
                  >
                    <span>{source.source}</span>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      <span>
                        {source.applications}{" "}
                        {source.applications === 1 ? "application" : "applications"}
                      </span>
                      <span className="w-8 text-right font-medium tabular-nums text-foreground">
                        {source.averageScore}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Under five analyses any chart would be describing noise. Saying how many
 * more are needed is more useful than drawing a confident-looking line through
 * two points.
 */
function ColdStart({ total }: { total: number }) {
  const remaining = MIN_ANALYSES_FOR_INSIGHTS - total;

  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Insights</h1>
      <div className="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
        <h2 className="text-base font-medium">
          {total === 0 ? "Nothing analysed yet" : `${total} of ${MIN_ANALYSES_FOR_INSIGHTS} analyses`}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {total === 0
            ? "This page finds the patterns across your analyses — which skills keep coming up that you don't have, whether your match scores are improving, and which sources are worth your time."
            : `Run ${remaining} more ${remaining === 1 ? "analysis" : "analyses"} and the patterns become meaningful. Charting fewer would just be drawing lines through noise.`}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/applications" className={buttonVariants()}>
            {total === 0 ? "Go analyse an application" : "Analyse another"}
          </Link>
          <Link href="/applications/new" className={buttonVariants({ variant: "secondary" })}>
            Add an application
          </Link>
        </div>
      </div>
    </div>
  );
}
