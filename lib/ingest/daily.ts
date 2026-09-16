import { db } from "../db";
import { runJobSearch, type SearchReport } from "./search";

/** Days a NEW lead may sit unread before the cron retires it. */
export const LEAD_TTL_DAYS = 30;
/** A lead the owner spent a model call on is kept this much longer. */
export const SCORED_LEAD_TTL_DAYS = 60;

export type DailyUserResult =
  | { userId: string; ok: true; report: SearchReport }
  | { userId: string; ok: false; error: string };

export type DailyRun = {
  users: DailyUserResult[];
  expired: number;
  ms: number;
};

/**
 * What the cron does, with no knowledge of HTTP: search for every user who
 * opted in, then retire stale leads. Users run one after another — each
 * search already fans out across its boards, and the boards are the same
 * 13 for everyone, so parallel users would only hammer them. One user's
 * failure is recorded and the next user still runs.
 */
export async function runDailySearch(now: Date = new Date()): Promise<DailyRun> {
  const start = Date.now();
  const optedIn = await db.jobPreferences.findMany({
    where: { autoSearch: true, NOT: { targetRoles: { isEmpty: true } } },
    select: { userId: true },
    orderBy: { lastAutoRunAt: { sort: "asc", nulls: "first" } },
  });

  const users: DailyUserResult[] = [];
  for (const { userId } of optedIn) {
    try {
      users.push({ userId, ok: true, report: await runJobSearch(userId) });
    } catch (error) {
      users.push({ userId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const expired = await expireStaleLeads(now);
  return { users, expired, ms: Date.now() - start };
}

/**
 * NEW leads nobody acted on become EXPIRED: out of the queue, not deleted, and
 * distinct from DISMISSED so "you said no" and "it went stale" stay different
 * facts. Runs for every user at once — it is a status change on the caller's
 * own rows only in the sense that the cron is the caller.
 */
export async function expireStaleLeads(now: Date = new Date()): Promise<number> {
  const unscoredBefore = new Date(now.getTime() - LEAD_TTL_DAYS * 86_400_000);
  const scoredBefore = new Date(now.getTime() - SCORED_LEAD_TTL_DAYS * 86_400_000);
  const result = await db.lead.updateMany({
    where: {
      status: "NEW",
      OR: [
        { matchScore: null, createdAt: { lt: unscoredBefore } },
        { matchScore: { not: null }, createdAt: { lt: scoredBefore } },
      ],
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

/** One log line per user, in the same terms the "Find new postings" button uses. */
export function formatDailyRun(run: DailyRun): string[] {
  const lines = run.users.map((u) =>
    u.ok
      ? `user ${u.userId}: ${u.report.postings} postings from ${u.report.boards} boards · ${u.report.created} new · ${u.report.alreadyKnown} known · ${u.report.filteredOut} not a fit${u.report.boardsFailed.length ? ` · ${u.report.boardsFailed.length} board(s) failed` : ""}`
      : `user ${u.userId}: FAILED — ${u.error}`,
  );
  lines.push(`expired ${run.expired} stale lead(s) · ${run.ms}ms`);
  return lines;
}
