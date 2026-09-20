/**
 * Transport-level retry, deliberately separate from the repair loop in
 * repair.ts. A 503 means the provider never answered; a schema failure means
 * it answered badly. Conflating them would either burn the single repair
 * attempt on a network blip or silently retry bad content.
 */
import { httpStatusOf, isQuotaExhausted } from "./provider-errors";

const RETRYABLE_STATUS = [429, 500, 502, 503, 504];
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;

export function isTransient(error: unknown): boolean {
  // A spent quota is a 429 that retrying cannot fix.
  if (isQuotaExhausted(error)) return false;
  if (isPerMinuteLimit(error)) return true;
  const status = httpStatusOf(error);
  return status !== null && RETRYABLE_STATUS.includes(status);
}

/**
 * Groq's tokens-per-minute ceiling (8 000 on the free tier) answers 413 when
 * the *sum* of this request and the minute's earlier ones is over the line —
 * "Request too large … Limit 8000, Requested 8361". Two structured-CV calls
 * back to back trip it. It clears within the minute, so it is worth one or
 * two waits; the message names the wait when it knows it.
 */
export function isPerMinuteLimit(error: unknown): boolean {
  const status = httpStatusOf(error);
  if (status !== 413 && status !== 429) return false;
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return message.includes("per minute") || message.includes("tpm") || message.includes("rpm");
}

function suggestedWaitMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/try again in ([\d.]+)\s*(ms|s)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return match[2].toLowerCase() === "ms" ? n : n * 1000;
}

const PER_MINUTE_WAIT_MS = 12_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = MAX_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === maxAttempts) break;
      // Exponential backoff: 1s, then 2s — or the provider's own wait for a
      // per-minute ceiling, which a two-second retry would only hit again.
      const wait = isPerMinuteLimit(error)
        ? Math.min(suggestedWaitMs(error) ?? PER_MINUTE_WAIT_MS, 30_000)
        : BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(wait);
    }
  }

  throw lastError;
}
