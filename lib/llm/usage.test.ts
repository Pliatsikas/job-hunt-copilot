import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, aggregate, upsert, limits } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  aggregate: vi.fn(),
  upsert: vi.fn(),
  limits: {
    perRoleLimits: {
      USER: { requests: 12, tokens: 40_000 },
      ADMIN: { requests: 150, tokens: 400_000 },
    },
    globalLimits: {
      requests: 900,
      tokens: 2_250_000,
      userShareRequests: 600,
      userShareTokens: 1_500_000,
    },
    llmEnabled: true,
  },
}));

vi.mock("../db", () => ({
  db: { user: { findUnique }, usageCounter: { aggregate, upsert } },
}));
vi.mock("../limits", () => ({
  get perRoleLimits() {
    return limits.perRoleLimits;
  },
  get globalLimits() {
    return limits.globalLimits;
  },
  get llmEnabled() {
    return limits.llmEnabled;
  },
  limitsFor: (role: "USER" | "ADMIN") => limits.perRoleLimits[role],
}));

import {
  assertWithinBudget,
  recordProviderCall,
  usageDayKey,
  usageResetsAt,
  UsageLimitError,
} from "./usage";

type Counter = { calls: number; inputTokens: number; outputTokens: number };

function setup(options: {
  role?: "USER" | "ADMIN";
  mine?: Partial<Counter>;
  global?: Partial<Counter>;
  userShare?: Partial<Counter>;
}) {
  const counter = (c: Partial<Counter> = {}): Counter => ({
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    ...c,
  });

  findUnique.mockResolvedValue({
    role: options.role ?? "USER",
    usageCounters: options.mine ? [counter(options.mine)] : [],
  });

  const globalSum = counter(options.global);
  const shareSum = counter(options.userShare ?? options.global);
  aggregate
    .mockResolvedValueOnce({ _sum: globalSum })
    .mockResolvedValueOnce({ _sum: shareSum });
}

beforeEach(() => {
  vi.clearAllMocks();
  limits.llmEnabled = true;
});

describe("usageDayKey", () => {
  it("uses the Athens date, not the UTC one", () => {
    // 00:30 on the 11th in Athens (UTC+3 in summer) is still the 10th in UTC.
    // Keying on UTC would hand out a second daily allowance two hours early.
    expect(usageDayKey(new Date("2026-09-10T21:30:00Z")).toISOString()).toBe(
      "2026-09-11T00:00:00.000Z",
    );
  });

  it("keeps 23:30 Athens on the same day it started", () => {
    expect(usageDayKey(new Date("2026-09-10T20:30:00Z")).toISOString()).toBe(
      "2026-09-10T00:00:00.000Z",
    );
  });

  it("tracks the winter offset too", () => {
    // 00:30 on 11 Jan in Athens is UTC+2, so 22:30 UTC on the 10th.
    expect(usageDayKey(new Date("2026-01-10T22:30:00Z")).toISOString()).toBe(
      "2026-01-11T00:00:00.000Z",
    );
  });
});

describe("usageResetsAt", () => {
  it("returns the next Athens midnight as a UTC instant", () => {
    // Summer: Athens midnight is 21:00 UTC the previous day.
    expect(usageResetsAt(new Date("2026-09-10T09:00:00Z")).toISOString()).toBe(
      "2026-09-10T21:00:00.000Z",
    );
  });

  it("shifts by an hour in winter", () => {
    expect(usageResetsAt(new Date("2026-01-10T09:00:00Z")).toISOString()).toBe(
      "2026-01-10T22:00:00.000Z",
    );
  });

  it("survives the spring-forward night, when the local day is 23 hours", () => {
    const resets = usageResetsAt(new Date("2026-03-28T12:00:00Z"));
    expect(resets.toISOString()).toBe("2026-03-28T22:00:00.000Z");
  });
});

describe("assertWithinBudget", () => {
  it("allows a call when nothing is close to a ceiling", async () => {
    setup({ mine: { calls: 3, inputTokens: 4_000, outputTokens: 1_000 } });
    await expect(assertWithinBudget("u1")).resolves.toMatchObject({ requests: 3 });
  });

  it("refuses on requests and names the count and the reset", async () => {
    setup({ mine: { calls: 12 } });
    const error = await assertWithinBudget("u1").catch((e) => e);

    expect(error).toBeInstanceOf(UsageLimitError);
    expect(error.scope).toBe("user");
    expect(error.metric).toBe("requests");
    expect(error.message).toContain("You've used 12 of 12 analyses and letters");
    expect(error.message).toContain("midnight (Athens time)");
    expect(error.resetsAt).toBeInstanceOf(Date);
  });

  it("refuses on tokens even with requests to spare", async () => {
    // The case a call-only limit misses entirely: four very long calls can
    // cost more than twelve short ones.
    setup({ mine: { calls: 4, inputTokens: 38_000, outputTokens: 2_500 } });
    const error = await assertWithinBudget("u1").catch((e) => e);

    expect(error.metric).toBe("tokens");
    expect(error.message).toContain("40,500 of 40,000 tokens");
  });

  it("counts input and output together", async () => {
    setup({ mine: { calls: 1, inputTokens: 39_999, outputTokens: 0 } });
    await expect(assertWithinBudget("u1")).resolves.toBeTruthy();

    setup({ mine: { calls: 1, inputTokens: 39_999, outputTokens: 1 } });
    await expect(assertWithinBudget("u1")).rejects.toThrow(UsageLimitError);
  });

  it("gives an admin the larger allowance", async () => {
    setup({ role: "ADMIN", mine: { calls: 20, inputTokens: 60_000, outputTokens: 0 } });
    await expect(assertWithinBudget("admin")).resolves.toMatchObject({ role: "ADMIN" });
  });

  it("stops a USER at the visitor share while the project ceiling is untouched", async () => {
    setup({
      mine: { calls: 1 },
      global: { calls: 600 },
    });
    const error = await assertWithinBudget("u1").catch((e) => e);

    expect(error.scope).toBe("global");
    expect(error.message).toContain("shared free-tier key");
  });

  it("lets an ADMIN through the visitor share — that is what the reserve is for", async () => {
    // 600 of 900 spent by visitors: a USER is refused, the owner is not.
    setup({ role: "ADMIN", mine: { calls: 2 }, global: { calls: 600 } });
    await expect(assertWithinBudget("admin")).resolves.toBeTruthy();
  });

  it("stops an ADMIN at the project ceiling", async () => {
    setup({ role: "ADMIN", mine: { calls: 2 }, global: { calls: 900 } });
    const error = await assertWithinBudget("admin").catch((e) => e);

    expect(error.scope).toBe("global");
  });

  it("refuses everything when the kill switch is off, without querying", async () => {
    limits.llmEnabled = false;
    const error = await assertWithinBudget("u1").catch((e) => e);

    expect(error.scope).toBe("disabled");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("fails CLOSED: an unreadable counter stops the call rather than allowing it", async () => {
    // The mirror of the auth limiter. Here the thing being rationed costs
    // real money, so an unverifiable budget must not be spent.
    findUnique.mockRejectedValueOnce(new Error("connection terminated"));
    aggregate.mockResolvedValue({ _sum: {} });

    await expect(assertWithinBudget("u1")).rejects.toThrow("connection terminated");
  });
});

describe("recordProviderCall", () => {
  it("increments the request and both token counts", async () => {
    await recordProviderCall("u1", { inputTokens: 1_690, outputTokens: 851 });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          calls: { increment: 1 },
          inputTokens: { increment: 1_690 },
          outputTokens: { increment: 851 },
        },
      }),
    );
  });

  it("still counts a request when the provider reports no usage", async () => {
    await recordProviderCall("u1");

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ calls: 1, inputTokens: 0, outputTokens: 0 }),
      }),
    );
  });
});
