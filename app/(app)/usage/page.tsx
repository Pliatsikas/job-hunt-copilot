import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";
import { getUsageToday, type UsageSnapshot } from "@/lib/llm/usage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Usage",
  description:
    "What you have spent against today's model budget, and when it resets.",
};

export const dynamic = "force-dynamic";

// The counters roll over on an Athens civil day, so the reset time is rendered
// in that zone too. Showing it in UTC would contradict the message the user
// gets when a limit trips.
const RESET_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

export default async function UsagePage() {
  const [t, user] = await Promise.all([getT(), requireUser()]);
  const usage = await getUsageToday(user.id);

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {t("usage.title")}
            {usage.role === "ADMIN" && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-medium">{t("usage.admin")}</span>
            )}
          </span>
        }
        description={t("usage.resets", { time: RESET_TIME.format(usage.resetsAt) })}
      />

      {!usage.enabled && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          {t("usage.disabled")}
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("usage.yours")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Meter
              label={t("usage.calls")}
              used={usage.requests}
              limit={usage.limits.requests}
            />
            <Meter label={t("usage.tokens")} used={usage.tokens} limit={usage.limits.tokens} />
            <p className="text-xs text-muted-foreground">
              {t("usage.whichever")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("usage.shared")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SharedBudget usage={usage} t={t} />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

/**
 * USER accounts are measured against the share reserved for visitors, ADMIN
 * against the whole project ceiling — showing each role the number that will
 * actually stop it, rather than one that never will.
 */
function SharedBudget({ usage, t }: { usage: UsageSnapshot; t: T }) {
  const { global, role } = usage;
  const isAdmin = role === "ADMIN";

  return (
    <>
      <Meter
        label={isAdmin ? t("usage.projectRequests") : t("usage.visitorRequests")}
        used={isAdmin ? global.requests : global.userShareRequests}
        limit={isAdmin ? global.limits.requests : global.limits.userShareRequests}
      />
      <Meter
        label={isAdmin ? t("usage.projectTokens") : t("usage.visitorTokens")}
        used={isAdmin ? global.tokens : global.userShareTokens}
        limit={isAdmin ? global.limits.tokens : global.limits.userShareTokens}
      />
      <p className="text-xs text-muted-foreground">
        {isAdmin ? t("usage.adminNote", { share: global.limits.userShareRequests.toLocaleString("en-GB") }) : t("usage.sharedNote")}
      </p>
    </>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  // Colour reinforces the number; it never carries the meaning alone.
  const tone = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {used.toLocaleString("en-GB")} / {limit.toLocaleString("en-GB")}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${used} / ${limit}`}
      >
        <div className={`animate-meter h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
