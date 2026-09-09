/**
 * All date arithmetic for the app. Instants are stored UTC; everything a user
 * sees is a *civil* date in their zone.
 *
 * The rule that keeps this correct: never subtract two instants and divide by
 * 86,400,000. Across a DST boundary a local day is 23 or 25 hours long, so that
 * arithmetic is wrong twice a year — and wrong in the direction that makes
 * "due today" fire a day early. Instead, both instants are reduced to a civil
 * (year, month, day) in the target zone and compared as calendar days.
 */

export const DEFAULT_TIME_ZONE = "Europe/Athens";

/** Days of no activity before an APPLIED application counts as stale. */
export const STALE_AFTER_DAYS = 10;

export type CivilDate = { year: number; month: number; day: number };

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    partsCache.set(timeZone, formatter);
  }
  return formatter;
}

/** The calendar date this instant falls on, as seen in `timeZone`. */
export function toCivilDate(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): CivilDate {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** "YYYY-MM-DD" in `timeZone`. Useful as a grouping key. */
export function civilDateKey(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const { year, month, day } = toCivilDate(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * A civil date as a day number. Uses Date.UTC purely as a calendar, with no
 * relationship to the instant's real offset — which is exactly what makes the
 * difference between two of these a true count of calendar days.
 */
function civilDayNumber(date: CivilDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);
}

/**
 * Whole calendar days from `from` to `to` as seen in `timeZone`. Positive when
 * `to` is later. Unaffected by DST, because it compares dates, not durations.
 */
export function calendarDaysBetween(
  from: Date,
  to: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): number {
  return (
    civilDayNumber(toCivilDate(to, timeZone)) - civilDayNumber(toCivilDate(from, timeZone))
  );
}

export function isSameCivilDay(a: Date, b: Date, timeZone: string = DEFAULT_TIME_ZONE): boolean {
  return calendarDaysBetween(a, b, timeZone) === 0;
}

/** Due when its civil date is today or earlier. */
export function isDueToday(
  nextActionAt: Date | null,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): boolean {
  if (!nextActionAt) return false;
  return calendarDaysBetween(nextActionAt, now, timeZone) === 0;
}

export function isOverdue(
  nextActionAt: Date | null,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): boolean {
  if (!nextActionAt) return false;
  return calendarDaysBetween(nextActionAt, now, timeZone) > 0;
}

/**
 * Staleness is measured from the last thing that happened on the application —
 * a note, a status change, an analysis — not from when it was created. Writing
 * a note yesterday means it is not stale, whatever the applied date says.
 */
export function isStale(
  lastActivityAt: Date | null,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
  thresholdDays: number = STALE_AFTER_DAYS,
): boolean {
  if (!lastActivityAt) return false;
  return calendarDaysBetween(lastActivityAt, now, timeZone) >= thresholdDays;
}

/**
 * Adds calendar days to an instant, preserving the local wall-clock time.
 * Naive +n*86400000 drifts by an hour across a DST boundary; this re-anchors
 * to the same local time on the target date.
 */
export function addCalendarDays(
  instant: Date,
  days: number,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  const target = new Date(instant.getTime() + days * 86_400_000);
  const drift = offsetMinutes(instant, timeZone) - offsetMinutes(target, timeZone);
  return new Date(target.getTime() + drift * 60_000);
}

/** Zone offset in minutes east of UTC for a given instant. */
export function offsetMinutes(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  // Reading the wall clock in the zone and treating it as UTC yields the offset.
  const asUtc = new Date(
    instant.toLocaleString("en-US", { timeZone: "UTC" }),
  ).getTime();
  const asZoned = new Date(instant.toLocaleString("en-US", { timeZone })).getTime();
  return Math.round((asZoned - asUtc) / 60_000);
}

/** Monday-based start of the civil week containing `instant`. */
export function startOfCivilWeek(
  instant: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): CivilDate {
  const civil = toCivilDate(instant, timeZone);
  const asUtc = new Date(Date.UTC(civil.year, civil.month - 1, civil.day));
  // getUTCDay: 0=Sunday. Shift so Monday is 0.
  const daysSinceMonday = (asUtc.getUTCDay() + 6) % 7;
  asUtc.setUTCDate(asUtc.getUTCDate() - daysSinceMonday);
  return {
    year: asUtc.getUTCFullYear(),
    month: asUtc.getUTCMonth() + 1,
    day: asUtc.getUTCDate(),
  };
}

/**
 * The UTC instant at which a civil date begins in `timeZone` — the boundary to
 * use in a Prisma `gte` filter when asking "since the start of this week".
 */
export function civilDateToUtcStart(
  date: CivilDate,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  // Guess midnight UTC, then correct by the zone's offset at that moment.
  const guess = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const corrected = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60_000);
  // One re-check: near a transition the offset at the guess may differ from
  // the offset at the corrected instant.
  const settled = new Date(guess.getTime() - offsetMinutes(corrected, timeZone) * 60_000);
  return settled;
}

/** Start of the current civil week as a UTC instant. */
export function startOfCurrentWeekUtc(
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  return civilDateToUtcStart(startOfCivilWeek(now, timeZone), timeZone);
}
