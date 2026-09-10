import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";
import { getUsageToday, type UsageSnapshot } from "@/lib/llm/usage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const user = await requireUser();
  const usage = await getUsageToday(user.id);

  return (
    <div className="px-6 py-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">Usage today</h1>
        {usage.role === "ADMIN" && (
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium">Admin</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Resets at {RESET_TIME.format(usage.resetsAt)} Athens time. A limit is meant to be
        visible before you hit it, not after.
      </p>

      {!usage.enabled && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Model calls are switched off right now. Nothing you have already generated is
          affected.
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your budget</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Meter
              label="Analyses and letters"
              used={usage.requests}
              limit={usage.limits.requests}
            />
            <Meter label="Tokens" used={usage.tokens} limit={usage.limits.tokens} />
            <p className="text-xs text-muted-foreground">
              Whichever runs out first stops the next call. Requests bind first on a normal
              day; a long job description spends tokens faster than requests.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shared budget</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SharedBudget usage={usage} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * USER accounts are measured against the share reserved for visitors, ADMIN
 * against the whole project ceiling — showing each role the number that will
 * actually stop it, rather than one that never will.
 */
function SharedBudget({ usage }: { usage: UsageSnapshot }) {
  const { global, role } = usage;
  const isAdmin = role === "ADMIN";

  return (
    <>
      <Meter
        label={isAdmin ? "Project requests" : "Visitor requests"}
        used={isAdmin ? global.requests : global.userShareRequests}
        limit={isAdmin ? global.limits.requests : global.limits.userShareRequests}
      />
      <Meter
        label={isAdmin ? "Project tokens" : "Visitor tokens"}
        used={isAdmin ? global.tokens : global.userShareTokens}
        limit={isAdmin ? global.limits.tokens : global.limits.userShareTokens}
      />
      <p className="text-xs text-muted-foreground">
        {isAdmin
          ? `Visitors share ${global.limits.userShareRequests.toLocaleString("en-GB")} of these requests between them; the rest is held back for you, so a busy day can't lock you out of your own app.`
          : "This is a shared free-tier key, so everyone using the app draws on the same daily allowance."}
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
        aria-label={`${label}: ${used} of ${limit} used`}
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
