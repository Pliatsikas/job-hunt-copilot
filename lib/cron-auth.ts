import { timingSafeEqual } from "node:crypto";

/**
 * Vercel calls cron routes with `Authorization: Bearer $CRON_SECRET`. Anything
 * else is refused — including every request when the secret is unset, so a
 * local dev server cannot be driven by a stray GET. Constant-time compare:
 * the secret is the only thing standing between the internet and a function
 * that reads 13 boards on every call.
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
