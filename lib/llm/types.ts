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

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  complete(request: LlmRequest): Promise<LlmResult>;
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
