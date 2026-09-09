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
