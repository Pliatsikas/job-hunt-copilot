/**
 * Transport-level retry, deliberately separate from the repair loop in
 * repair.ts. A 503 means the provider never answered; a schema failure means
 * it answered badly. Conflating them would either burn the single repair
 * attempt on a network blip or silently retry bad content.
 */
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;

function statusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return status;

  // Some SDKs only put the code in the message body.
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/"code"\s*:\s*(\d{3})/);
  return match ? Number(match[1]) : null;
}

export function isTransient(error: unknown): boolean {
  const status = statusOf(error);
  return status !== null && RETRYABLE_STATUS.includes(status);
}

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
      // Exponential backoff: 1s, then 2s.
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
