import { describe, expect, it } from "vitest";
import { addCalendarDays, calendarDaysBetween, civilDateKey } from "../dates";
import { nextActionForStatus, SNOOZE_DAYS, STATUS_FOLLOW_UP_DAYS } from "./follow-up-policy";

const ATHENS = "Europe/Athens";

describe("nextActionForStatus", () => {
  const now = new Date("2026-09-09T09:00:00Z");

  it("schedules the ten-day nudge after applying", () => {
    const due = nextActionForStatus("APPLIED", now, ATHENS)!;
    expect(calendarDaysBetween(now, due, ATHENS)).toBe(10);
    expect(civilDateKey(due, ATHENS)).toBe("2026-09-19");
  });

  it("schedules the thank-you two days after an interview", () => {
    const due = nextActionForStatus("INTERVIEW", now, ATHENS)!;
    expect(calendarDaysBetween(now, due, ATHENS)).toBe(2);
    expect(civilDateKey(due, ATHENS)).toBe("2026-09-11");
  });

  it("schedules nothing for statuses with nothing left to chase", () => {
    for (const status of ["SAVED", "SCREENING", "OFFER", "REJECTED", "WITHDRAWN"]) {
      expect(nextActionForStatus(status, now, ATHENS)).toBeNull();
    }
  });

  it("lands on the right calendar day when the interval crosses a DST change", () => {
    // 22 Mar + 10 days crosses the 29 Mar spring-forward.
    const beforeDst = new Date("2026-03-22T10:00:00Z");
    const due = nextActionForStatus("APPLIED", beforeDst, ATHENS)!;
    expect(civilDateKey(due, ATHENS)).toBe("2026-04-01");
    expect(calendarDaysBetween(beforeDst, due, ATHENS)).toBe(10);
  });

  it("keeps a late-evening schedule on the intended day, not the next one", () => {
    // 23:30 Athens on 9 Sept. A naive +10*86400000 stays correct here, but the
    // civil-day assertion is what actually matters to the user.
    const lateEvening = new Date("2026-09-09T20:30:00Z");
    const due = nextActionForStatus("APPLIED", lateEvening, ATHENS)!;
    expect(civilDateKey(due, ATHENS)).toBe("2026-09-19");
  });

  it("exposes the cadence as data rather than magic numbers", () => {
    expect(STATUS_FOLLOW_UP_DAYS.APPLIED).toBe(10);
    expect(STATUS_FOLLOW_UP_DAYS.INTERVIEW).toBe(2);
    expect(SNOOZE_DAYS).toBe(3);
  });
});

describe("snooze anchoring", () => {
  // The rule the action implements: snooze from the later of now and the
  // existing date. Exercised live in M6 — snoozing from a stale overdue date
  // left an item still overdue, so the button looked broken.
  function snoozeAnchor(nextActionAt: Date | null, now: Date): Date {
    return nextActionAt && nextActionAt > now ? nextActionAt : now;
  }

  const now = new Date("2026-09-09T09:00:00Z");

  it("pushes an overdue item forward from today, not from its stale date", () => {
    const overdue = new Date("2026-08-30T09:00:00Z"); // 10 days late
    const anchor = snoozeAnchor(overdue, now);
    expect(anchor).toBe(now);
    const snoozed = addCalendarDays(anchor, SNOOZE_DAYS, ATHENS);
    expect(calendarDaysBetween(now, snoozed, ATHENS)).toBe(3);
  });

  it("pushes a future item further out rather than pulling it closer", () => {
    const future = new Date("2026-09-20T09:00:00Z");
    const anchor = snoozeAnchor(future, now);
    expect(anchor).toBe(future);
    const snoozed = addCalendarDays(anchor, SNOOZE_DAYS, ATHENS);
    expect(calendarDaysBetween(future, snoozed, ATHENS)).toBe(3);
  });

  it("anchors to now when no date is set at all", () => {
    expect(snoozeAnchor(null, now)).toBe(now);
  });
});
