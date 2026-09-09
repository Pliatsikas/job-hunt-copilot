import { db } from "../db";
import { env } from "../env";
import { AnalysisError } from "./repair";

/** UTC midnight for the counter's @db.Date column. */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getUsageToday(userId: string) {
  const counter = await db.usageCounter.findUnique({
    where: { userId_day: { userId, day: today() } },
  });
  return { calls: counter?.calls ?? 0, limit: env.DAILY_LLM_CALL_LIMIT };
}

/** Throws before a provider call if the user is already at the daily cap. */
export async function assertUnderDailyLimit(userId: string) {
  const { calls, limit } = await getUsageToday(userId);
  if (calls >= limit) {
    throw new AnalysisError(
      `Daily limit reached (${limit} model calls). This resets at midnight UTC.`,
    );
  }
}

/**
 * Counts a provider call that actually completed — a repair attempt is a
 * second call and is counted as one, because it costs quota either way.
 */
export async function recordProviderCall(userId: string) {
  const day = today();
  await db.usageCounter.upsert({
    where: { userId_day: { userId, day } },
    update: { calls: { increment: 1 } },
    create: { userId, day, calls: 1 },
  });
}
