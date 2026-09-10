import { clientIpFrom } from "./client-ip";
import { env } from "./env";
import {
  consumeAll,
  describeRetryAfter,
  pruneRateLimits,
  windowStart,
  type RateLimitVerdict,
} from "./rate-limit";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

const PRUNE_EVERY_MS = HOUR;
const PRUNE_KEEP_MS = 2 * DAY;
let lastPruneAt = 0;

/**
 * Old windows can no longer refuse anything, and one row per (IP, window)
 * means an attacker rotating addresses grows the table as fast as they can
 * rotate. There is no cron in this deployment, so cleanup rides along with
 * the writes — at most once an hour per instance, and never blocking the
 * caller: a failed prune must not fail an auth attempt.
 */
function pruneOccasionally(now: Date): void {
  if (now.getTime() - lastPruneAt < PRUNE_EVERY_MS) return;
  lastPruneAt = now.getTime();
  void pruneRateLimits(new Date(now.getTime() - PRUNE_KEEP_MS));
}

/** Test seam: lets a test exercise the interval without waiting an hour. */
export function resetPruneClock(): void {
  lastPruneAt = 0;
}

/**
 * Registration is priced highest of anything here: each account that gets
 * created mints a fresh daily token budget, so it is the cheapest way to
 * multiply the project's exposure. Two windows, because one alone is either
 * too tight for a household or too loose for a script left running overnight.
 */
export async function checkRegisterLimit(headers: Headers, now = new Date()) {
  const ip = clientIpFrom(headers);
  pruneOccasionally(now);
  return consumeAll(
    [
      { key: `register:h:${ip}`, rule: { windowMs: HOUR, max: env.REGISTER_LIMIT_PER_HOUR } },
      { key: `register:d:${ip}`, rule: { windowMs: DAY, max: env.REGISTER_LIMIT_PER_DAY } },
    ],
    now,
  );
}

/**
 * Generous enough for typos and password managers, useless for stuffing.
 *
 * Called from `authorize()` rather than from the sign-in server action,
 * because Auth.js accepts a direct POST to /api/auth/callback/credentials as
 * well — a limiter in the action would only cover the path that a browser
 * form happens to take, and not the one a script would.
 */
export async function checkLoginLimit(headers: Headers, now = new Date()) {
  const ip = clientIpFrom(headers);
  pruneOccasionally(now);
  return consumeAll(
    [
      {
        key: `login:${ip}`,
        rule: { windowMs: FIFTEEN_MINUTES, max: env.LOGIN_LIMIT_PER_15_MIN },
      },
    ],
    now,
  );
}

/**
 * Time left in the current login window, derived rather than read back. The
 * windows are fixed and floor-aligned, so this is exact — and it lets the
 * sign-in action describe the wait without a second query that would count
 * as another attempt.
 */
export function loginRetryAfterMs(now = new Date()): number {
  return windowStart(now, FIFTEEN_MINUTES).getTime() + FIFTEEN_MINUTES - now.getTime();
}

export function registerLimitMessage(verdict: RateLimitVerdict): string {
  return `Too many accounts created from this network. Try again ${describeRetryAfter(
    verdict.retryAfterMs,
  )}, or sign in if you already have an account.`;
}

export function loginLimitMessage(verdict: RateLimitVerdict): string {
  return `Too many sign-in attempts. Try again ${describeRetryAfter(verdict.retryAfterMs)}.`;
}
