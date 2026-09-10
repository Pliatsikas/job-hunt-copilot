import type { z } from "zod";

export type LlmUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
};

export type LlmResult = {
  /** Raw model output. Parsing and repair belong to the shared layer. */
  text: string;
  usage: LlmUsage;
  latencyMs: number;
};

export type LlmRequest = {
  system: string;
  user: string;
  /**
   * The Zod schema the response must satisfy. Each provider derives its own
   * structured-output configuration from it — feature code never sees which.
   */
  schema: z.ZodType;
  maxTokens?: number;
  temperature?: number;
};

/**
 * Free-text generation. No schema: there is nothing to validate mid-stream,
 * which is precisely why this may stream while analysis may not
 * (SPEC.md §8 Α4).
 */
export type LlmStreamRequest = Omit<LlmRequest, "schema">;

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  complete(request: LlmRequest): Promise<LlmResult>;
  /**
   * Yields text chunks as they arrive and *returns* what the call cost.
   *
   * The generator's return value carries the usage rather than a callback or
   * a second method: a `for await` consumer that doesn't care ignores it for
   * free, and one that does care cannot forget to read it, because the type
   * says the iteration ends with an LlmUsage. Both providers only know the
   * token counts after the final chunk, so there is nowhere earlier to put it.
   *
   * Cover letters are the most-used path in the app; leaving them out of the
   * budget would have made the budget fiction (SPEC.md §6.1).
   */
  stream(request: LlmStreamRequest): AsyncGenerator<string, LlmUsage, void>;
}

/** No usage reported — a provider may decline, and a request still counts. */
export const NO_USAGE: LlmUsage = { inputTokens: null, outputTokens: null };

/**
 * Drains a provider stream, forwarding text to `onChunk` and returning the
 * usage the generator ended with. `for await` discards a generator's return
 * value, so the manual loop is the only way to see it.
 */
export async function drainStream(
  stream: AsyncGenerator<string, LlmUsage, void>,
  onChunk: (text: string) => void,
): Promise<LlmUsage> {
  const iterator = stream[Symbol.asyncIterator]();
  for (;;) {
    const next = await iterator.next();
    if (next.done) return next.value ?? NO_USAGE;
    onChunk(next.value);
  }
}

/** Thrown when a provider itself fails (network, auth, quota). */
export class LlmProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LlmProviderError";
  }
}

/**
 * A rejected credential. Carries the name of the environment variable that
 * needs fixing, because "API key not valid" on its own doesn't tell you which
 * of several keys, in which of several environments, to go and look at.
 */
export class LlmAuthError extends LlmProviderError {
  constructor(provider: string, public readonly envVar: string, cause?: unknown) {
    super(
      provider,
      `${envVar} was rejected by the provider. Check that the key is valid and set for this environment.`,
      cause,
    );
    this.name = "LlmAuthError";
  }
}

/**
 * The provider's allowance is spent. Named separately from a generic failure
 * because the useful response is "wait" or "switch provider", not "retry".
 */
export class LlmQuotaError extends LlmProviderError {
  constructor(provider: string, model: string, cause?: unknown) {
    super(
      provider,
      `${provider} has no quota left for ${model} right now — the free tier caps requests per day. Wait for it to reset, or set LLM_PROVIDER to another provider.`,
      cause,
    );
    this.name = "LlmQuotaError";
  }
}

/**
 * The provider rejected its own model's output for not matching the schema.
 * Distinct from a transport failure: retrying the identical request would
 * reproduce it, but a repair attempt carrying the error might not. Named so
 * the shared layer can route it to the repair path rather than to backoff.
 */
export class LlmSchemaError extends LlmProviderError {
  constructor(
    provider: string,
    message: string,
    /** The partial output the provider refused, when it reports one. */
    public readonly failedGeneration: string | null,
    cause?: unknown,
  ) {
    super(provider, message, cause);
    this.name = "LlmSchemaError";
  }
}
