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
  /** Yields text chunks as they arrive. */
  stream(request: LlmStreamRequest): AsyncIterable<string>;
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
