import type { z } from "zod";
import {
  LlmSchemaError,
  NO_USAGE,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type LlmUsage,
} from "./types";

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
  onProviderCall?: (usage: LlmUsage) => Promise<void>,
): Promise<ParsedCompletion<z.infer<T>>> {
  // Counted after the call returns, not before: a provider that never
  // answered shouldn't consume the user's daily budget.
  //
  // A provider that validates before returning (Groq's strict mode) rejects
  // bad output as a 400 instead of handing it over. That is still a schema
  // failure, so it earns the same single repair rather than a backoff — but
  // the call happened and is billed, so it is counted either way.
  let first: LlmResult;
  try {
    first = await provider.complete({ ...request, schema });
    await onProviderCall?.(first.usage);
  } catch (error) {
    if (!(error instanceof LlmSchemaError)) throw error;
    await onProviderCall?.(NO_USAGE);
    return repairAfterProviderRejection(provider, request, schema, error, onProviderCall);
  }

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
  await onProviderCall?.(second.usage);

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

/**
 * The repair path for a provider that refused to return its model's output.
 * There is no text to quote back, so the prompt gets the provider's complaint
 * and — when it reports one — the partial generation it rejected.
 */
async function repairAfterProviderRejection<T extends z.ZodType>(
  provider: LlmProvider,
  request: Omit<LlmRequest, "schema">,
  schema: T,
  rejection: LlmSchemaError,
  onProviderCall?: (usage: LlmUsage) => Promise<void>,
): Promise<ParsedCompletion<z.infer<T>>> {
  const truncatedAt = rejection.failedGeneration
    ? `\n\nIt stopped here:\n${rejection.failedGeneration.slice(-400)}`
    : "";

  const retry = await provider.complete({
    ...request,
    schema,
    user: `${request.user}

## Your previous reply was rejected
${rejection.message}${truncatedAt}

Return the complete JSON object this time, with every required field present. Be more
selective: fewer, better entries in the arrays, so the answer fits.`,
  });
  await onProviderCall?.(retry.usage);

  const parsed = trySafeParse(schema, retry.text);
  if (parsed.success) {
    return { data: parsed.data, usage: retry.usage, latencyMs: retry.latencyMs, attempts: 2 };
  }

  throw new AnalysisError(
    "The model's answer didn't fit the required format, twice. Nothing was saved — try again, or shorten the job description.",
    parsed.error,
  );
}
