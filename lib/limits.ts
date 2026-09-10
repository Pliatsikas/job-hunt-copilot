import { env } from "./env";

export type Role = "USER" | "ADMIN";

export type RoleLimits = {
  requests: number;
  tokens: number;
};

/**
 * Every number is an env var so that switching provider is a config change,
 * not an edit to this file. The defaults below are the Groq profile, measured
 * rather than quoted: `openai/gpt-oss-120b` reports
 * `x-ratelimit-limit-requests: 1000` with an 86.4s refill (= 86400/1000, so a
 * daily bucket) and `x-ratelimit-limit-tokens: 8000` refilling in under a
 * second (a per-minute bucket).
 *
 * The per-minute token bucket is deliberately not modelled here. It clears in
 * seconds, and a 429 from it carries no quota marker, so `isQuotaExhausted()`
 * classifies it as transient and `withTransientRetry()` waits it out — which
 * is the correct response to a rate that will free itself. These counters
 * exist for the allowances that do *not* free themselves within a request.
 */
export const perRoleLimits: Record<Role, RoleLimits> = {
  USER: {
    requests: env.USER_DAILY_REQUESTS,
    tokens: env.USER_DAILY_TOKENS,
  },
  ADMIN: {
    requests: env.ADMIN_DAILY_REQUESTS,
    tokens: env.ADMIN_DAILY_TOKENS,
  },
};

/**
 * Two global ceilings, not one. `global` is the whole project's daily budget,
 * held below the provider's measured ceiling so a hard provider 429 is never
 * the first sign of trouble. `userShare` is how much of it USER accounts may
 * consume between them; the remainder is reserved for ADMIN, so a busy day
 * from visitors degrades the public demo without locking the owner out of
 * their own app.
 */
export const globalLimits = {
  requests: env.GLOBAL_DAILY_REQUESTS,
  tokens: env.GLOBAL_DAILY_TOKENS,
  userShareRequests: env.GLOBAL_USER_SHARE_REQUESTS,
  userShareTokens: env.GLOBAL_USER_SHARE_TOKENS,
};

export const llmEnabled = env.LLM_ENABLED;

export function limitsFor(role: Role): RoleLimits {
  return perRoleLimits[role];
}
