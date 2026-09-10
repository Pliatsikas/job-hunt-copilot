import { db } from "../db";
import {
  DEFAULT_TIME_ZONE,
  addCalendarDays,
  civilDateToUtcStart,
  toCivilDate,
} from "../dates";
import { globalLimits, limitsFor, llmEnabled, type Role } from "../limits";

/**
 * The storage key for a day's counter. `@db.Date` holds a plain calendar date,
 * so the convention is UTC midnight of that date — but *which* date is decided
 * in Athens, not UTC. At 01:30 Athens time the UTC date is still yesterday;
 * counting that against yesterday's budget would hand a user a second
 * allowance a couple of hours before their own midnight (SPEC.md §6.1).
 */
export function usageDayKey(now: Date = new Date(), timeZone = DEFAULT_TIME_ZONE): Date {
  const civil = toCivilDate(now, timeZone);
  return new Date(Date.UTC(civil.year, civil.month - 1, civil.day));
}

/** The instant the current budget window ends: next midnight, in Athens. */
export function usageResetsAt(now: Date = new Date(), timeZone = DEFAULT_TIME_ZONE): Date {
  const tomorrow = toCivilDate(addCalendarDays(now, 1, timeZone), timeZone);
  return civilDateToUtcStart(tomorrow, timeZone);
}

export type LimitScope = "user" | "global" | "disabled";
export type LimitMetric = "requests" | "tokens";

/**
 * Refused before a provider call. Carries which ceiling was hit and when it
 * lifts, because "something went wrong" is the one thing §6.1 rules out — the
 * same pattern as LlmAuthError naming the variable it wants fixed.
 */
export class UsageLimitError extends Error {
  constructor(
    message: string,
    public readonly scope: LimitScope,
    public readonly metric: LimitMetric | null,
    public readonly resetsAt: Date | null,
  ) {
    super(message);
    this.name = "UsageLimitError";
  }
}

const DEMO_HINT = "The demo account has pre-generated examples if you want to keep exploring.";

export type UsageSnapshot = {
  role: Role;
  requests: number;
  tokens: number;
  limits: { requests: number; tokens: number };
  global: {
    requests: number;
    tokens: number;
    userShareRequests: number;
    userShareTokens: number;
    limits: typeof globalLimits;
  };
  resetsAt: Date;
  enabled: boolean;
};

/**
 * One round trip for the caller's own counter and role, two aggregates for the
 * shared ceilings. All three are indexed on `day`.
 */
export async function getUsageToday(
  userId: string,
  now: Date = new Date(),
): Promise<UsageSnapshot> {
  const day = usageDayKey(now);

  const [user, globalSum, userShareSum] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { role: true, usageCounters: { where: { day } } },
    }),
    db.usageCounter.aggregate({
      where: { day },
      _sum: { calls: true, inputTokens: true, outputTokens: true },
    }),
    db.usageCounter.aggregate({
      where: { day, user: { role: "USER" } },
      _sum: { calls: true, inputTokens: true, outputTokens: true },
    }),
  ]);

  if (!user) throw new Error("Unauthorized");

  const role = user.role as Role;
  const mine = user.usageCounters[0];
  const sum = (s: { inputTokens: number | null; outputTokens: number | null }) =>
    (s.inputTokens ?? 0) + (s.outputTokens ?? 0);

  return {
    role,
    requests: mine?.calls ?? 0,
    tokens: (mine?.inputTokens ?? 0) + (mine?.outputTokens ?? 0),
    limits: limitsFor(role),
    global: {
      requests: globalSum._sum.calls ?? 0,
      tokens: sum(globalSum._sum),
      userShareRequests: userShareSum._sum.calls ?? 0,
      userShareTokens: sum(userShareSum._sum),
      limits: globalLimits,
    },
    resetsAt: usageResetsAt(now),
    enabled: llmEnabled,
  };
}

function plural(n: number) {
  return n.toLocaleString("en-GB");
}

/**
 * Throws before a provider call if any ceiling is already reached. Fails
 * closed: if this check itself cannot run, the call does not happen. Spending
 * real money on an unverifiable budget is the worse of the two failures — the
 * mirror of the auth limiter, which fails open (see lib/rate-limit.ts).
 */
export async function assertWithinBudget(
  userId: string,
  now: Date = new Date(),
): Promise<UsageSnapshot> {
  if (!llmEnabled) {
    throw new UsageLimitError(
      "Model calls are switched off right now. Everything you've already generated is saved.",
      "disabled",
      null,
      null,
    );
  }

  const usage = await getUsageToday(userId, now);
  const { limits, global } = usage;

  if (usage.requests >= limits.requests) {
    throw new UsageLimitError(
      `You've used your model calls for today. You've used ${usage.requests} of ${limits.requests} analyses and letters. This resets at midnight (Athens time). ${DEMO_HINT}`,
      "user",
      "requests",
      usage.resetsAt,
    );
  }

  if (usage.tokens >= limits.tokens) {
    throw new UsageLimitError(
      `You've used your model calls for today. You've used ${plural(usage.tokens)} of ${plural(limits.tokens)} tokens. This resets at midnight (Athens time). ${DEMO_HINT}`,
      "user",
      "tokens",
      usage.resetsAt,
    );
  }

  // ADMIN is exempt from the user share but not from the project ceiling: the
  // share exists so a busy day from visitors leaves the owner some room, and
  // the ceiling exists so nothing at all runs the key dry.
  const globalChecks: Array<[boolean, LimitMetric]> = [
    [global.requests >= global.limits.requests, "requests"],
    [global.tokens >= global.limits.tokens, "tokens"],
    [
      usage.role === "USER" && global.userShareRequests >= global.limits.userShareRequests,
      "requests",
    ],
    [
      usage.role === "USER" && global.userShareTokens >= global.limits.userShareTokens,
      "tokens",
    ],
  ];

  for (const [tripped, metric] of globalChecks) {
    if (tripped) {
      throw new UsageLimitError(
        "The app has hit its daily model budget. This is a shared free-tier key, not a problem with your account — everything you've already generated is saved. It resets at midnight (Athens time).",
        "global",
        metric,
        usage.resetsAt,
      );
    }
  }

  return usage;
}

/**
 * Counts a provider call that actually completed, with the tokens it cost. A
 * repair attempt is a second call and is counted as one, because it is billed
 * as one. Usage is nullable per the provider contract; a call whose cost the
 * provider declined to report still counts as a request.
 */
export async function recordProviderCall(
  userId: string,
  usage: { inputTokens: number | null; outputTokens: number | null } = {
    inputTokens: null,
    outputTokens: null,
  },
  now: Date = new Date(),
): Promise<void> {
  const day = usageDayKey(now);
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  await db.usageCounter.upsert({
    where: { userId_day: { userId, day } },
    update: {
      calls: { increment: 1 },
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
    },
    create: { userId, day, calls: 1, inputTokens, outputTokens },
  });
}
