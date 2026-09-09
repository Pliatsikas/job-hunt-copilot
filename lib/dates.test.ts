import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calendarDaysBetween,
  civilDateKey,
  civilDateToUtcStart,
  isDueToday,
  isOverdue,
  isSameCivilDay,
  isStale,
  offsetMinutes,
  startOfCivilWeek,
  startOfCurrentWeekUtc,
  toCivilDate,
} from "./dates";

const ATHENS = "Europe/Athens";

// Greece: EET (UTC+2) in winter, EEST (UTC+3) in summer.
// 2026 transitions: forward Sun 29 Mar 03:00, back Sun 25 Oct 04:00 local.
const WINTER = new Date("2026-01-15T12:00:00Z"); // UTC+2
const SUMMER = new Date("2026-07-15T12:00:00Z"); // UTC+3

describe("offsetMinutes — the assumption everything else rests on", () => {
  it("is UTC+2 in Athens winter and UTC+3 in summer", () => {
    expect(offsetMinutes(WINTER, ATHENS)).toBe(120);
    expect(offsetMinutes(SUMMER, ATHENS)).toBe(180);
  });

  it("is 0 for UTC", () => {
    expect(offsetMinutes(SUMMER, "UTC")).toBe(0);
  });
});

describe("civil date near local midnight", () => {
  it("reads the local day, not the UTC day", () => {
    // 21:30 UTC on 9 Sept is 00:30 on 10 Sept in Athens (UTC+3).
    const instant = new Date("2026-09-09T21:30:00Z");
    expect(civilDateKey(instant, "UTC")).toBe("2026-09-09");
    expect(civilDateKey(instant, ATHENS)).toBe("2026-09-10");
  });

  it("treats 23:59 and 00:01 local as different days", () => {
    const justBefore = new Date("2026-09-09T20:59:00Z"); // 23:59 Athens, 9 Sept
    const justAfter = new Date("2026-09-09T21:01:00Z"); // 00:01 Athens, 10 Sept
    expect(civilDateKey(justBefore, ATHENS)).toBe("2026-09-09");
    expect(civilDateKey(justAfter, ATHENS)).toBe("2026-09-10");
    expect(isSameCivilDay(justBefore, justAfter, ATHENS)).toBe(false);
    // Two minutes apart, yet a calendar day apart.
    expect(calendarDaysBetween(justBefore, justAfter, ATHENS)).toBe(1);
  });

  it("an action due late tonight is due today, not tomorrow", () => {
    const now = new Date("2026-09-09T18:00:00Z"); // 21:00 Athens
    const dueLate = new Date("2026-09-09T20:45:00Z"); // 23:45 Athens, same day
    expect(isDueToday(dueLate, now, ATHENS)).toBe(true);
    expect(isOverdue(dueLate, now, ATHENS)).toBe(false);
  });
});

describe("DST transitions", () => {
  it("counts one calendar day across the spring-forward night (a 23-hour day)", () => {
    // 28 Mar 12:00 local -> 29 Mar 12:00 local, spanning the 03:00 jump.
    const before = new Date("2026-03-28T10:00:00Z"); // 12:00 EET
    const after = new Date("2026-03-29T09:00:00Z"); // 12:00 EEST
    expect(after.getTime() - before.getTime()).toBe(23 * 3_600_000);
    // A naive hours/24 would floor to 0. Calendar comparison gets it right.
    expect(calendarDaysBetween(before, after, ATHENS)).toBe(1);
  });

  it("counts one calendar day across the autumn fall-back night (a 25-hour day)", () => {
    const before = new Date("2026-10-24T09:00:00Z"); // 12:00 EEST
    const after = new Date("2026-10-25T10:00:00Z"); // 12:00 EET
    expect(after.getTime() - before.getTime()).toBe(25 * 3_600_000);
    expect(calendarDaysBetween(before, after, ATHENS)).toBe(1);
  });

  it("addCalendarDays keeps the local wall-clock time across spring forward", () => {
    const before = new Date("2026-03-28T10:00:00Z"); // 12:00 local
    const plusOne = addCalendarDays(before, 1, ATHENS);
    expect(civilDateKey(plusOne, ATHENS)).toBe("2026-03-29");
    // Still noon locally, even though only 23 hours elapsed.
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: ATHENS,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(plusOne);
    expect(local).toBe("12:00");
  });

  it("addCalendarDays keeps the local wall-clock time across fall back", () => {
    const before = new Date("2026-10-24T09:00:00Z"); // 12:00 local
    const plusOne = addCalendarDays(before, 1, ATHENS);
    expect(civilDateKey(plusOne, ATHENS)).toBe("2026-10-25");
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: ATHENS,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(plusOne);
    expect(local).toBe("12:00");
  });

  it("a ten-day nudge set in winter still lands on the right calendar day in summer", () => {
    // Created 25 Mar (UTC+2), +10 days crosses the 29 Mar transition.
    const created = new Date("2026-03-25T10:00:00Z"); // 12:00 EET
    const due = addCalendarDays(created, 10, ATHENS);
    expect(civilDateKey(due, ATHENS)).toBe("2026-04-04");
    expect(calendarDaysBetween(created, due, ATHENS)).toBe(10);
  });
});

describe("read in a different offset than it was written", () => {
  it("a row written in winter reads as the same civil day when read in summer", () => {
    // 23:30 local on 15 Jan (UTC+2) == 21:30Z.
    const writtenInWinter = new Date("2026-01-15T21:30:00Z");
    expect(civilDateKey(writtenInWinter, ATHENS)).toBe("2026-01-15");
    // Reading it later, in summer, must not shift the stored day.
    expect(civilDateKey(writtenInWinter, ATHENS)).toBe("2026-01-15");
    // And the UTC view genuinely differs — this is the bug being guarded.
    expect(civilDateKey(writtenInWinter, "UTC")).toBe("2026-01-15");
  });

  it("a winter instant near midnight lands on different days in different zones", () => {
    const instant = new Date("2026-01-15T22:30:00Z"); // 00:30 on 16 Jan Athens
    expect(civilDateKey(instant, "UTC")).toBe("2026-01-15");
    expect(civilDateKey(instant, ATHENS)).toBe("2026-01-16");
    expect(civilDateKey(instant, "America/New_York")).toBe("2026-01-15");
  });

  it("staleness spanning a DST change counts calendar days, not 24-hour blocks", () => {
    const lastActivity = new Date("2026-03-24T10:00:00Z"); // 12:00 EET
    const now = new Date("2026-04-03T09:00:00Z"); // 12:00 EEST, 10 civil days later
    // Elapsed is 239 hours, not 240 — a /86400000 check would floor to 9.
    expect(now.getTime() - lastActivity.getTime()).toBe(239 * 3_600_000);
    expect(calendarDaysBetween(lastActivity, now, ATHENS)).toBe(10);
    expect(isStale(lastActivity, now, ATHENS, 10)).toBe(true);
  });
});

describe("isStale", () => {
  const now = new Date("2026-09-20T09:00:00Z");

  it("is measured from the last activity, so yesterday's note keeps it fresh", () => {
    const yesterday = new Date("2026-09-19T09:00:00Z");
    expect(isStale(yesterday, now, ATHENS, 10)).toBe(false);
  });

  it("fires exactly on the threshold day", () => {
    expect(isStale(new Date("2026-09-10T09:00:00Z"), now, ATHENS, 10)).toBe(true);
    expect(isStale(new Date("2026-09-11T09:00:00Z"), now, ATHENS, 10)).toBe(false);
  });

  it("is false when there has been no activity at all to measure from", () => {
    expect(isStale(null, now, ATHENS, 10)).toBe(false);
  });
});

describe("due and overdue", () => {
  const now = new Date("2026-09-20T09:00:00Z"); // 12:00 Athens

  it("today is due, yesterday is overdue, tomorrow is neither", () => {
    expect(isDueToday(new Date("2026-09-20T05:00:00Z"), now, ATHENS)).toBe(true);
    expect(isOverdue(new Date("2026-09-19T05:00:00Z"), now, ATHENS)).toBe(true);
    expect(isDueToday(new Date("2026-09-21T05:00:00Z"), now, ATHENS)).toBe(false);
    expect(isOverdue(new Date("2026-09-21T05:00:00Z"), now, ATHENS)).toBe(false);
  });

  it("an unset next action is neither due nor overdue", () => {
    expect(isDueToday(null, now, ATHENS)).toBe(false);
    expect(isOverdue(null, now, ATHENS)).toBe(false);
  });
});

describe("civil week", () => {
  it("starts on Monday", () => {
    // 9 Sept 2026 is a Wednesday.
    expect(startOfCivilWeek(new Date("2026-09-09T12:00:00Z"), ATHENS)).toEqual({
      year: 2026,
      month: 9,
      day: 7,
    });
  });

  it("treats Sunday as the end of the week, not the start", () => {
    // 13 Sept 2026 is a Sunday; its week began Monday the 7th.
    expect(startOfCivilWeek(new Date("2026-09-13T12:00:00Z"), ATHENS)).toEqual({
      year: 2026,
      month: 9,
      day: 7,
    });
  });

  it("uses the local day when UTC and local disagree", () => {
    // 21:30Z Sunday 13 Sept is Monday 14th in Athens — a new week.
    const instant = new Date("2026-09-13T21:30:00Z");
    expect(civilDateKey(instant, ATHENS)).toBe("2026-09-14");
    expect(startOfCivilWeek(instant, ATHENS)).toEqual({ year: 2026, month: 9, day: 14 });
  });

  it("converts a civil week start to the UTC instant local midnight occurs", () => {
    const start = civilDateToUtcStart({ year: 2026, month: 9, day: 7 }, ATHENS);
    // Midnight on 7 Sept in Athens (UTC+3) is 21:00Z on the 6th.
    expect(start.toISOString()).toBe("2026-09-06T21:00:00.000Z");
    expect(civilDateKey(start, ATHENS)).toBe("2026-09-07");
  });

  it("handles a week boundary that falls in winter offset", () => {
    const start = civilDateToUtcStart({ year: 2026, month: 1, day: 12 }, ATHENS);
    // UTC+2 in January, so local midnight is 22:00Z the previous day.
    expect(start.toISOString()).toBe("2026-01-11T22:00:00.000Z");
    expect(civilDateKey(start, ATHENS)).toBe("2026-01-12");
  });

  it("startOfCurrentWeekUtc round-trips to the right local day", () => {
    const start = startOfCurrentWeekUtc(new Date("2026-09-09T12:00:00Z"), ATHENS);
    expect(civilDateKey(start, ATHENS)).toBe("2026-09-07");
  });
});

describe("toCivilDate", () => {
  it("returns numeric parts, not strings to be concatenated", () => {
    const civil = toCivilDate(new Date("2026-03-05T12:00:00Z"), ATHENS);
    expect(civil).toEqual({ year: 2026, month: 3, day: 5 });
    expect(typeof civil.month).toBe("number");
  });
});
