import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { env } from "@/lib/env";
import { formatDailyRun, runDailySearch } from "@/lib/ingest/daily";

// The database and the board fetches need Node; nothing here may be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hobby ceiling. ~3 users × ~14 boards fits comfortably; if this ever nears
// the limit, batch users across invocations rather than raising it.
export const maxDuration = 60;

/**
 * The daily run. Declared in vercel.json; Vercel triggers it once a day on
 * the Hobby plan (within the scheduled hour, not to the minute). The log
 * lines are the run's record — see docs/tasks/T05-daily-search.md.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const run = await runDailySearch();
  for (const line of formatDailyRun(run)) console.log(`[cron daily-search] ${line}`);

  return NextResponse.json({
    ok: true,
    users: run.users.length,
    failed: run.users.filter((u) => !u.ok).length,
    created: run.users.reduce((n, u) => n + (u.ok ? u.report.created : 0), 0),
    expired: run.expired,
    ms: run.ms,
  });
}
