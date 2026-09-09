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
