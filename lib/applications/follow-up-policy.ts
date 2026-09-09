import { addCalendarDays, DEFAULT_TIME_ZONE } from "../dates";

/**
 * Pure scheduling policy, deliberately free of server imports so it can be
 * tested without dragging in auth and the database. The actions in
 * reminders.ts apply it; this module only decides.
 */

export const SNOOZE_DAYS = 3;

/**
 * Follow-up cadence applied automatically when a status changes. Terminal
 * statuses are absent on purpose — there is nothing left to chase.
 */
export const STATUS_FOLLOW_UP_DAYS: Partial<Record<string, number>> = {
  APPLIED: 10, // the polite nudge
  INTERVIEW: 2, // the thank-you note
};

/** The next action a status change implies, or null to leave it alone. */
export function nextActionForStatus(
  status: string,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date | null {
  const days = STATUS_FOLLOW_UP_DAYS[status];
  return days === undefined ? null : addCalendarDays(now, days, timeZone);
}
