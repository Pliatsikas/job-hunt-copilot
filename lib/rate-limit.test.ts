import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsert, deleteMany } = vi.hoisted(() => ({ upsert: vi.fn(), deleteMany: vi.fn() }));
vi.mock("./db", () => ({ db: { rateLimit: { upsert, deleteMany } } }));

import {
  consumeAll,
  consumeRateLimit,
  describeRetryAfter,
  pruneRateLimits,
  windowStart,
} from "./rate-limit";

const HOUR = 60 * 60 * 1000;

/** Stands in for the unique constraint: one counter per (key, window). */
function fakeStore() {
  const counts = new Map<string, number>();
  upsert.mockImplementation(
    async ({ where }: { where: { key_windowStart: { key: string; windowStart: Date } } }) => {
      const id = `${where.key_windowStart.key}@${where.key_windowStart.windowStart.getTime()}`;
      const next = (counts.get(id) ?? 0) + 1;
      counts.set(id, next);
      return { count: next };
    },
  );
  return counts;
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeStore();
});

describe("windowStart", () => {
  it("floors to the window so concurrent callers share one row", () => {
    const a = windowStart(new Date("2026-09-10T14:05:00Z"), HOUR);
    const b = windowStart(new Date("2026-09-10T14:59:59Z"), HOUR);
    expect(a.toISOString()).toBe("2026-09-10T14:00:00.000Z");
    expect(a.getTime()).toBe(b.getTime());
  });

  it("starts a new window at the boundary", () => {
    const before = windowStart(new Date("2026-09-10T14:59:59Z"), HOUR);
    const after = windowStart(new Date("2026-09-10T15:00:00Z"), HOUR);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("consumeRateLimit", () => {
  const rule = { windowMs: HOUR, max: 3 };
  const now = new Date("2026-09-10T14:20:00Z");

  it("allows exactly max attempts and refuses the next", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await consumeRateLimit("register:h:1.1.1.1", rule, now)).allowed).toBe(true);
    }
    const fourth = await consumeRateLimit("register:h:1.1.1.1", rule, now);
    expect(fourth.allowed).toBe(false);
  });

  it("reports the time left in the window, not the whole window", async () => {
    for (let i = 0; i < 4; i++) await consumeRateLimit("k", rule, now);
    const refused = await consumeRateLimit("k", rule, now);
    // 14:20 into a window that began at 14:00 leaves 40 minutes.
    expect(refused.retryAfterMs).toBe(40 * 60 * 1000);
  });

  it("keys separately per IP", async () => {
    for (let i = 0; i < 3; i++) await consumeRateLimit("login:1.1.1.1", rule, now);
    expect((await consumeRateLimit("login:2.2.2.2", rule, now)).allowed).toBe(true);
  });

  it("forgets the count once the window rolls over", async () => {
    for (let i = 0; i < 4; i++) await consumeRateLimit("k", rule, now);
    const nextWindow = new Date("2026-09-10T15:00:00Z");
    expect((await consumeRateLimit("k", rule, nextWindow)).allowed).toBe(true);
  });

  it("fails OPEN when the counter table is unreachable", async () => {
    // The opposite of the LLM budget on purpose: a broken counter here would
    // lock real users out of an otherwise healthy app, and what it rations is
    // cheap. The failure is logged rather than swallowed.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    upsert.mockRejectedValueOnce(new Error("connection terminated"));

    const verdict = await consumeRateLimit("k", rule, now);

    expect(verdict.allowed).toBe(true);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe("consumeAll", () => {
  const now = new Date("2026-09-10T14:20:00Z");
  const entries = [
    { key: "register:h:ip", rule: { windowMs: HOUR, max: 2 } },
    { key: "register:d:ip", rule: { windowMs: 24 * HOUR, max: 5 } },
  ];

  it("refuses as soon as any single rule is exhausted", async () => {
    await consumeAll(entries, now);
    await consumeAll(entries, now);
    expect((await consumeAll(entries, now)).allowed).toBe(false);
  });

  it("burns the daily allowance even while the hourly one is blocking", async () => {
    // Otherwise a script could hammer a blocked hourly window for free and
    // arrive at the next hour with its daily budget untouched.
    for (let i = 0; i < 4; i++) await consumeAll(entries, now);

    const nextHour = new Date("2026-09-10T15:20:00Z");
    // Hourly window is fresh, but only one of five daily attempts remains.
    expect((await consumeAll(entries, nextHour)).allowed).toBe(true);
    expect((await consumeAll(entries, nextHour)).allowed).toBe(false);
  });

  it("reports the longest wait of the rules that refused", async () => {
    for (let i = 0; i < 8; i++) await consumeAll(entries, now);
    const verdict = await consumeAll(entries, now);
    // The daily window has far longer to run than the hourly one.
    expect(verdict.retryAfterMs).toBeGreaterThan(HOUR);
  });
});

describe("describeRetryAfter", () => {
  it("rounds up to whole minutes, so it never says zero", () => {
    expect(describeRetryAfter(30_000)).toBe("in 1 minute");
    expect(describeRetryAfter(41 * 60_000 + 1)).toBe("in 42 minutes");
  });

  it("switches to hours past the hour mark", () => {
    expect(describeRetryAfter(90 * 60_000)).toBe("in 2 hours");
  });

  it("degrades to a vague answer rather than a negative one", () => {
    expect(describeRetryAfter(null)).toBe("shortly");
    expect(describeRetryAfter(-5)).toBe("shortly");
  });
});

describe("pruneRateLimits", () => {
  it("reports zero rather than throwing when the delete fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    deleteMany.mockRejectedValueOnce(new Error("nope"));
    expect(await pruneRateLimits(new Date())).toBe(0);
    logged.mockRestore();
  });
});

describe("pruneOccasionally, via the auth limiters", () => {
  it("prunes at most once an hour and never blocks the attempt", async () => {
    const { checkLoginLimit, resetPruneClock } = await import("./auth-limits");
    resetPruneClock();
    deleteMany.mockResolvedValue({ count: 3 });

    const headers = new Headers({ "x-real-ip": "198.51.100.4" });
    const start = new Date("2026-09-10T10:00:00Z");

    await checkLoginLimit(headers, start);
    await checkLoginLimit(headers, new Date("2026-09-10T10:30:00Z"));
    expect(deleteMany).toHaveBeenCalledTimes(1);

    await checkLoginLimit(headers, new Date("2026-09-10T11:30:00Z"));
    expect(deleteMany).toHaveBeenCalledTimes(2);
  });

  it("still allows the attempt when the prune itself fails", async () => {
    const { checkLoginLimit, resetPruneClock } = await import("./auth-limits");
    resetPruneClock();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    deleteMany.mockRejectedValue(new Error("prune failed"));

    const verdict = await checkLoginLimit(new Headers({ "x-real-ip": "198.51.100.5" }));

    expect(verdict.allowed).toBe(true);
    logged.mockRestore();
  });
});
