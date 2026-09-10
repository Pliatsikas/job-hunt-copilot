import Groq from "groq-sdk";
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
} from "groq-sdk/resources/chat/completions";
import { toJsonSchema } from "../json-schema";
import {
  failedGenerationOf,
  isAuthFailure,
  isQuotaExhausted,
  isSchemaValidationFailure,
} from "../provider-errors";
import { withTransientRetry } from "../retry";
import {
  LlmAuthError,
  LlmProviderError,
  LlmQuotaError,
  LlmSchemaError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type LlmStreamRequest,
  type LlmUsage,
  NO_USAGE,
} from "../types";

/**
 * The usage-bearing final chunk, which groq-sdk's `ChatCompletionChunk` does
 * not describe. Declaring the shape we actually receive keeps the read typed;
 * both fields stay optional because only the last chunk carries them.
 */
type ChunkWithUsage = ChatCompletionChunk & {
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};

export function createGroqProvider(apiKey: string, model: string): LlmProvider {
  const client = new Groq({ apiKey });

  return {
    name: "groq",
    model,

    async complete(request: LlmRequest): Promise<LlmResult> {
      // Strict json_schema mode needs additionalProperties:false and every
      // property listed in required — which is exactly what Zod 4 emits, so
      // unlike Gemini nothing has to be stripped here.
      const schema = toJsonSchema(request.schema);
      const startedAt = Date.now();

      try {
        const response = await withTransientRetry(() =>
          client.chat.completions.create({
          model,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: {
            type: "json_schema",
              json_schema: { name: "analysis_result", schema, strict: true },
            },
          }),
        );

        const text = response.choices[0]?.message?.content ?? "";
        if (!text.trim()) {
          throw new LlmProviderError("groq", "Groq returned an empty response");
        }
        if (response.choices[0]?.finish_reason === "length") {
          throw new LlmProviderError(
            "groq",
            "Groq hit its output limit before finishing. Try a shorter job description.",
          );
        }

        return {
          text,
          usage: {
            inputTokens: response.usage?.prompt_tokens ?? null,
            outputTokens: response.usage?.completion_tokens ?? null,
          },
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        if (error instanceof LlmProviderError) throw error;
        // Named here, where the provider knows which variable holds its key.
        if (isQuotaExhausted(error)) throw new LlmQuotaError("groq", model, error);
        if (isAuthFailure(error)) throw new LlmAuthError("groq", "GROQ_API_KEY", error);
        // Strict mode rejects its own model's output before returning it, so a
        // response that ran out of tokens mid-array arrives as a 400 rather
        // than with finish_reason "length". It is a schema failure wearing a
        // transport failure's clothes.
        if (isSchemaValidationFailure(error)) {
          throw new LlmSchemaError(
            "groq",
            "Groq rejected the model's output for not matching the schema — usually the answer ran out of room before it finished.",
            failedGenerationOf(error),
            error,
          );
        }
        throw new LlmProviderError(
          "groq",
          error instanceof Error ? error.message : "Groq request failed",
          error,
        );
      }
    },

    async *stream(request: LlmStreamRequest): AsyncGenerator<string, LlmUsage, void> {
      try {
        // `stream_options` is accepted by the API (verified against the live
        // endpoint: the final chunk comes back with a usage object) but is
        // missing from groq-sdk's request type, which trails the service. The
        // intersection adds the field without reaching for `any` — and the
        // day the SDK catches up, this narrows to a no-op rather than
        // silently masking a real type error.
        const params: ChatCompletionCreateParamsStreaming & {
          stream_options?: { include_usage?: boolean };
          reasoning_effort?: "low" | "medium" | "high";
        } = {
          model,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: true,
          // gpt-oss reasons before answering, and on prose that reasoning is
          // most of the bill: measured at 824 of 972 completion tokens for one
          // cover letter, against 36 at "low". Same letter, 46% fewer tokens
          // end to end and a third of the latency.
          //
          // Only on stream(). complete() keeps full reasoning, because the
          // structured analysis is the one place the deliberation earns its
          // cost — the same split as Gemini's thinkingBudget in M4.
          reasoning_effort: "low",
          // Without this the stream reports no usage at all and every
          // generated letter would cost the budget nothing.
          stream_options: { include_usage: true },
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
        };

        const response = await withTransientRetry(() =>
          client.chat.completions.create(params),
        );

        let truncated = false;
        let usage: LlmUsage = NO_USAGE;
        for await (const chunk of response) {
          // The usage chunk arrives last and carries `choices: []`, so the
          // optional chaining below is load-bearing, not defensive habit.
          const text = chunk.choices[0]?.delta?.content;
          if (text) yield text;
          if (chunk.choices[0]?.finish_reason === "length") truncated = true;
          const reported = (chunk as ChunkWithUsage).usage;
          if (reported) {
            usage = {
              inputTokens: reported.prompt_tokens ?? null,
              outputTokens: reported.completion_tokens ?? null,
            };
          }
        }
        if (truncated) {
          throw new LlmProviderError(
            "groq",
            "Groq hit its output limit before finishing this document.",
          );
        }
        return usage;
      } catch (error) {
        if (isQuotaExhausted(error)) throw new LlmQuotaError("groq", model, error);
        if (isAuthFailure(error)) throw new LlmAuthError("groq", "GROQ_API_KEY", error);
        throw new LlmProviderError(
          "groq",
          error instanceof Error ? error.message : "Groq stream failed",
          error,
        );
      }
    },
  };
}
