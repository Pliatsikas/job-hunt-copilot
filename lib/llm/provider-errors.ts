/**
 * Shared HTTP-shape inspection for provider failures. Providers surface errors
 * in different shapes — a `status` field, or only a JSON body in the message —
 * so both are checked here rather than in each caller.
 */
export function httpStatusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;

  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return status;

  const message = error instanceof Error ? error.message : "";
  const match = message.match(/"code"\s*:\s*(\d{3})/);
  return match ? Number(match[1]) : null;
}

const AUTH_MARKERS = [
  "api_key_invalid",
  "api key not valid",
  "invalid_api_key",
  "invalid api key",
  "unauthenticated",
  "permission_denied",
  "missing api key",
  "incorrect api key",
];

/**
 * A rejected credential, as distinct from a malformed request. 401/403 are
 * unambiguous; a 400 only counts when the body actually blames the key —
 * Gemini returns INVALID_ARGUMENT for both bad keys and bad schemas, and
 * mislabelling the second as an auth problem would send you hunting the wrong
 * bug.
 */
export function isAuthFailure(error: unknown): boolean {
  const status = httpStatusOf(error);
  if (status === 401 || status === 403) return true;
  if (status !== 400) return false;

  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return AUTH_MARKERS.some((marker) => message.includes(marker));
}

const QUOTA_MARKERS = [
  "resource_exhausted",
  "exceeded your current quota",
  "quota exceeded",
  "insufficient_quota",
];

/**
 * A spent allowance, not a momentary spike. Both arrive as 429, but only one
 * is worth retrying: a per-minute limit clears in seconds, a daily quota does
 * not, and hammering it three times with backoff just wastes the user's time
 * before showing them the same failure.
 */
export function isQuotaExhausted(error: unknown): boolean {
  if (httpStatusOf(error) !== 429) return false;
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return QUOTA_MARKERS.some((marker) => message.includes(marker));
}

/**
 * Groq's strict `json_schema` mode validates before returning, so a model that
 * runs out of output tokens mid-array comes back as an HTTP 400 rather than as
 * a truncated body with `finish_reason: "length"`. That makes it look like a
 * transport failure when it is really the model failing to satisfy the schema
 * — which is precisely what the one repair attempt exists for.
 */
export function isSchemaValidationFailure(error: unknown): boolean {
  if (httpStatusOf(error) !== 400) return false;
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return (
    message.includes("json_validate_failed") ||
    message.includes("does not match the expected schema")
  );
}

/**
 * The partial output the provider rejected. Worth surfacing: the repair prompt
 * can say what was wrong with the previous attempt instead of asking blind.
 */
export function failedGenerationOf(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/"failed_generation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}
