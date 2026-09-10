import { db } from "./db";

export type RateLimitRule = {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Attempts permitted per key per window. */
  max: number;
};

export type RateLimitVerdict = {
  allowed: boolean;
  /** Null when allowed. */
  retryAfterMs: number | null;
};

/**
 * Fixed windows, floor-aligned so every caller in the same window shares a row
 * and the unique constraint does the concurrency work. A sliding window would
 * be fairer at the boundary; it would also need one row per attempt, and the
 * failure this defends against — a script minting accounts — is not one that a
 * boundary edge helps with.
 */
export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/**
 * Counts one attempt against `key` and says whether it is permitted.
 *
 * Fails **open**: if the counter table cannot be reached, the attempt is
 * allowed and the failure is logged. This is the opposite of the LLM budget,
 * on purpose. A broken counter there costs money; a broken counter here would
 * lock every real user out of an app that is otherwise healthy, and the thing
 * being rationed is cheap.
 */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitVerdict> {
  const start = windowStart(now, rule.windowMs);

  try {
    const row = await db.rateLimit.upsert({
      where: { key_windowStart: { key, windowStart: start } },
      update: { count: { increment: 1 } },
      create: { key, windowStart: start, count: 1 },
      select: { count: true },
    });

    if (row.count <= rule.max) return { allowed: true, retryAfterMs: null };

    return {
      allowed: false,
      retryAfterMs: start.getTime() + rule.windowMs - now.getTime(),
    };
  } catch (error) {
    console.error(`Rate limit check failed for ${key}, allowing the attempt:`, error);
    return { allowed: true, retryAfterMs: null };
  }
}

/** Every rule for a key must pass; the first refusal wins. */
export async function consumeAll(
  entries: Array<{ key: string; rule: RateLimitRule }>,
  now: Date = new Date(),
): Promise<RateLimitVerdict> {
  let refusal: RateLimitVerdict | null = null;

  // Every rule is consumed even after one refuses, so a caller hammering a
  // blocked hourly window still burns their daily allowance.
  for (const entry of entries) {
    const verdict = await consumeRateLimit(entry.key, entry.rule, now);
    if (!verdict.allowed && (!refusal || (verdict.retryAfterMs ?? 0) > (refusal.retryAfterMs ?? 0))) {
      refusal = verdict;
    }
  }

  return refusal ?? { allowed: true, retryAfterMs: null };
}

export function describeRetryAfter(ms: number | null): string {
  if (ms === null || ms <= 0) return "shortly";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `in ${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * Best-effort removal of windows that can no longer refuse anything. Called
 * opportunistically rather than on a schedule — there is no cron in this
 * deployment, and the table is small enough that a stale row costs nothing.
 */
export async function pruneRateLimits(olderThan: Date): Promise<number> {
  try {
    const { count } = await db.rateLimit.deleteMany({
      where: { windowStart: { lt: olderThan } },
    });
    return count;
  } catch (error) {
    console.error("Rate limit prune failed:", error);
    return 0;
  }
}
