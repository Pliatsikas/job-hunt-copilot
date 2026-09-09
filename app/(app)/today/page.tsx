import Link from "next/link";
import { markActionDone, snoozeApplication } from "@/lib/applications/reminders";
import { getTodayData, type TodayItem } from "@/lib/applications/today";
import { STALE_AFTER_DAYS } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemActions } from "./item-actions";

// Reads "today" per request; a cached page would go stale at local midnight.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const data = await getTodayData();

  if (data.pipelineEmpty) return <EmptyPipeline />;

  const nothingDue =
    data.overdue.length === 0 && data.dueToday.length === 0 && data.stale.length === 0;

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.appliedThisWeek === 0
            ? `No applications sent this week · ${data.activeTotal} active`
            : `${data.appliedThisWeek} sent this week · ${data.activeTotal} active`}
        </p>
      </div>

      {nothingDue ? (
        <NothingDue appliedThisWeek={data.appliedThisWeek} />
      ) : (
        <div className="flex flex-col gap-6">
          {data.overdue.length > 0 && (
            <Section
              title="Overdue"
              count={data.overdue.length}
              hint="Past their follow-up date."
              items={data.overdue}
              tone="destructive"
            />
          )}
          {data.dueToday.length > 0 && (
            <Section
              title="Due today"
              count={data.dueToday.length}
              hint="Clear these and the day is done."
              items={data.dueToday}
            />
          )}
          {data.stale.length > 0 && (
            <Section
              title="Going quiet"
              count={data.stale.length}
              hint={`Applied, and nothing has happened for ${STALE_AFTER_DAYS}+ days.`}
              items={data.stale}
              showActivity
            />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  hint,
  items,
  tone,
  showActivity,
}: {
  title: string;
  count: number;
  hint: string;
  items: TodayItem[];
  tone?: "destructive";
  showActivity?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={tone === "destructive" ? "text-destructive" : undefined}>
          {title} ({count})
        </CardTitle>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <Link
                href={`/applications/${item.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {item.roleTitle}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={item.status as never} />
                {item.companyName && <span>{item.companyName}</span>}
                {showActivity
                  ? item.daysSinceActivity !== null && (
                      <span>{item.daysSinceActivity} days quiet</span>
                    )
                  : item.nextActionAt && <span>due {formatDate(item.nextActionAt)}</span>}
              </div>
            </div>
            <ItemActions
              snooze={snoozeApplication.bind(null, item.id)}
              markDone={markActionDone.bind(null, item.id)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Zero data is the state a new user actually sees. It names the one action
 * that makes the app do anything, rather than reporting emptiness.
 */
function EmptyPipeline() {
  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Today</h1>
      <div className="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
        <h2 className="text-base font-medium">Start with one job posting</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Paste an ad you are considering. You will get a match score against your CV, the gaps
          worth preparing for, and a cover letter that addresses them — and this page will
          start telling you what needs chasing.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link href="/applications/new" className={buttonVariants()}>
            Add your first application
          </Link>
          <Link
            href="/profile"
            className={buttonVariants({ variant: "secondary" })}
          >
            Add your CV first
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The analysis compares against your CV, so that has to be in place before it can say
          anything useful.
        </p>
      </div>
    </div>
  );
}

/** Pipeline has rows, just nothing needing attention right now. */
function NothingDue({ appliedThisWeek }: { appliedThisWeek: number }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <h2 className="text-base font-medium">Nothing needs chasing today</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {appliedThisWeek === 0
          ? "Nothing has gone out this week either — the pipeline only moves when something new enters it."
          : "Everything with a follow-up date is either ahead of you or already handled."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link href="/applications/new" className={buttonVariants()}>
          Add an application
        </Link>
        <Link href="/applications" className={buttonVariants({ variant: "secondary" })}>
          Review the pipeline
        </Link>
      </div>
    </div>
  );
}
