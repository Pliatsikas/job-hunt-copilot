import type { Metadata } from "next";
import Link from "next/link";
import { getInsights, MIN_ANALYSES_FOR_INSIGHTS } from "@/lib/applications/insights";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { GapBarChart } from "@/components/gap-bar-chart";
import { ScoreTrendChart } from "@/components/score-trend-chart";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Patterns across your analyses — recurring skill gaps, how your match score is moving, and which sources are worth your time.",
};

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const [t, insights] = await Promise.all([getT(), getInsights()]);

  if (insights.totalAnalyses < MIN_ANALYSES_FOR_INSIGHTS) {
    return <ColdStart total={insights.totalAnalyses} t={t} />;
  }

  return (
    <Page>
      <PageHeader title={t("insights.title")} description={t("insights.across", { analyses: insights.totalAnalyses, applications: insights.analysedApplications })} />

      {insights.headline && (
        <p className="mt-4 max-w-3xl rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
          {insights.headline}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("insights.gapsTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("insights.gapsSub")}</p>
          </CardHeader>
          <CardContent>
            {insights.missingSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("insights.noGaps")}</p>
            ) : (
              <GapBarChart skills={insights.missingSkills} t={t} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("insights.trendTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("insights.trendSub")}</p>
          </CardHeader>
          <CardContent>
            {insights.scoreTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("insights.nothingToPlot")}</p>
            ) : (
              <ScoreTrendChart points={insights.scoreTrend} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("insights.sourcesTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("insights.sourcesSub")}</p>
          </CardHeader>
          <CardContent>
            {insights.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("insights.noSources")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {insights.sources.map((source) => (
                  <li
                    key={source.source}
                    className="flex items-center justify-between gap-4 border-b pb-2 text-sm last:border-0"
                  >
                    <span>{source.source}</span>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      <span>{t("applications.active", { count: source.applications })}</span>
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
    </Page>
  );
}

/**
 * Under five analyses any chart would be describing noise. Saying how many
 * more are needed is more useful than drawing a confident-looking line through
 * two points.
 */
function ColdStart({ total, t }: { total: number; t: T }) {
  const remaining = MIN_ANALYSES_FOR_INSIGHTS - total;

  return (
    <Page>
      <PageHeader title={t("insights.title")} />
      <div className="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
        <h2 className="text-base font-medium">
          {total === 0 ? t("insights.coldNothing") : t("insights.coldSome", { total, min: MIN_ANALYSES_FOR_INSIGHTS })}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {total === 0 ? t("insights.coldSubNothing") : t("insights.coldSubSome", { remaining })}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/applications" className={buttonVariants()}>
            {t("insights.goAnalyse")}
          </Link>
          <Link href="/applications/new" className={buttonVariants({ variant: "secondary" })}>
            {t("insights.addApplication")}
          </Link>
        </div>
      </div>
    </Page>
  );
}
