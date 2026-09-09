import type { z } from "zod";
import type { LlmProvider, LlmRequest, LlmUsage } from "./types";

/** User-facing failure. Nothing is persisted when this is thrown. */
export class AnalysisError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AnalysisError";
  }
}

export type ParsedCompletion<T> = {
  data: T;
  usage: LlmUsage;
  latencyMs: number;
  /** 1 = parsed first time, 2 = needed the repair attempt. */
  attempts: number;
};

/**
 * Models sometimes wrap JSON in prose or a code fence even under structured
 * output. Pull out the outermost object rather than failing on the wrapper.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new SyntaxError("No JSON object found in the response");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function describeFailure(error: z.ZodError): string {
  return error.issues
    .slice(0, 10)
    .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

function sumUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  const add = (x: number | null, y: number | null) =>
    x === null && y === null ? null : (x ?? 0) + (y ?? 0);
  return {
    inputTokens: add(a.inputTokens, b.inputTokens),
    outputTokens: add(a.outputTokens, b.outputTokens),
  };
}

/**
 * Exactly one repair attempt, and only for schema/parse failures — the retry
 * carries the validation error so the model can correct itself rather than
 * guessing. A second failure throws; the caller persists nothing.
 */
export async function completeWithRepair<T extends z.ZodType>(
  provider: LlmProvider,
  request: Omit<LlmRequest, "schema">,
  schema: T,
  onProviderCall?: () => Promise<void>,
): Promise<ParsedCompletion<z.infer<T>>> {
  // Counted after the call returns, not before: a provider that never
  // answered shouldn't consume the user's daily budget.
  const first = await provider.complete({ ...request, schema });
  await onProviderCall?.();

  const firstParse = trySafeParse(schema, first.text);
  if (firstParse.success) {
    return { data: firstParse.data, usage: first.usage, latencyMs: first.latencyMs, attempts: 1 };
  }

  const repairRequest: Omit<LlmRequest, "schema"> = {
    ...request,
    user: `${request.user}

## Your previous reply was rejected
It did not satisfy the required schema:
${describeFailure(firstParse.error)}

Return corrected JSON only. Same task, same rules — fix the structure.`,
  };

  const second = await provider.complete({ ...repairRequest, schema });
  await onProviderCall?.();

  const usage = sumUsage(first.usage, second.usage);
  const latencyMs = first.latencyMs + second.latencyMs;

  const secondParse = trySafeParse(schema, second.text);
  if (secondParse.success) {
    return { data: secondParse.data, usage, latencyMs, attempts: 2 };
  }

  throw new AnalysisError(
    "The model returned a response that didn't match the expected format, twice. Nothing was saved — try again.",
    secondParse.error,
  );
}

type ParseOutcome<T> = { success: true; data: T } | { success: false; error: z.ZodError };

function trySafeParse<T extends z.ZodType>(schema: T, text: string): ParseOutcome<z.infer<T>> {
  let json: unknown;
  try {
    json = extractJson(text);
  } catch (error) {
    // Shape the JSON failure like a Zod failure so the repair prompt is uniform.
    return {
      success: false,
      error: {
        issues: [
          {
            path: [],
            message:
              error instanceof Error ? error.message : "Response was not valid JSON",
          },
        ],
      } as unknown as z.ZodError,
    };
  }

  const parsed = schema.safeParse(json);
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, error: parsed.error };
}
