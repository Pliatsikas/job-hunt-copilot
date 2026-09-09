import { requireUser } from "../auth";
import {
  calendarDaysBetween,
  isDueToday,
  isOverdue,
  isStale,
  startOfCurrentWeekUtc,
  STALE_AFTER_DAYS,
  DEFAULT_TIME_ZONE,
} from "../dates";
import { db } from "../db";

export type TodayItem = {
  id: string;
  roleTitle: string;
  companyName: string | null;
  status: string;
  nextActionAt: Date | null;
  lastActivityAt: Date | null;
  daysSinceActivity: number | null;
};

export type TodayData = {
  overdue: TodayItem[];
  dueToday: TodayItem[];
  stale: TodayItem[];
  appliedThisWeek: number;
  activeTotal: number;
  /** Nothing tracked at all, as opposed to nothing due. */
  pipelineEmpty: boolean;
};

/**
 * Classification happens in JS rather than SQL because "today" is a civil date
 * in the viewer's zone, and the comparison has to survive DST — which is what
 * lib/dates exists for. At personal-tracker scale the read is cheap; if this
 * ever needed to scale, the fix is a pre-computed local-day column, not
 * date arithmetic in the query.
 */
export async function getTodayData(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<TodayData> {
  const user = await requireUser();

  const applications = await db.application.findMany({
    where: { userId: user.id, archivedAt: null },
    include: {
      company: { select: { name: true } },
      // Scoped by the parent's userId filter; one row is all staleness needs.
      events: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
    },
  });

  const weekStart = startOfCurrentWeekUtc(now, timeZone);

  const overdue: TodayItem[] = [];
  const dueToday: TodayItem[] = [];
  const stale: TodayItem[] = [];
  let appliedThisWeek = 0;

  for (const application of applications) {
    // Staleness is measured from real activity. Falling back to appliedAt (not
    // createdAt) keeps the clock meaningful for an application that was filed
    // without ever being touched again.
    const lastActivityAt = application.events[0]?.at ?? application.appliedAt ?? null;

    const item: TodayItem = {
      id: application.id,
      roleTitle: application.roleTitle,
      companyName: application.company?.name ?? null,
      status: application.status,
      nextActionAt: application.nextActionAt,
      lastActivityAt,
      daysSinceActivity: lastActivityAt
        ? calendarDaysBetween(lastActivityAt, now, timeZone)
        : null,
    };

    if (isOverdue(application.nextActionAt, now, timeZone)) {
      overdue.push(item);
    } else if (isDueToday(application.nextActionAt, now, timeZone)) {
      dueToday.push(item);
    } else if (
      application.status === "APPLIED" &&
      isStale(lastActivityAt, now, timeZone, STALE_AFTER_DAYS)
    ) {
      // Only surfaced when nothing more urgent already claims it — an item
      // with an action due today does not also need chasing as neglected.
      stale.push(item);
    }

    if (application.appliedAt && application.appliedAt >= weekStart) appliedThisWeek += 1;
  }

  const byUrgency = (a: TodayItem, b: TodayItem) =>
    (a.nextActionAt?.getTime() ?? 0) - (b.nextActionAt?.getTime() ?? 0);

  overdue.sort(byUrgency);
  dueToday.sort(byUrgency);
  stale.sort((a, b) => (b.daysSinceActivity ?? 0) - (a.daysSinceActivity ?? 0));

  return {
    overdue,
    dueToday,
    stale,
    appliedThisWeek,
    activeTotal: applications.length,
    pipelineEmpty: applications.length === 0,
  };
}
