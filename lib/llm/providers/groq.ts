import Groq from "groq-sdk";
import { toJsonSchema } from "../json-schema";
import { isAuthFailure, isQuotaExhausted } from "../provider-errors";
import { withTransientRetry } from "../retry";
import {
  LlmAuthError,
  LlmProviderError,
  LlmQuotaError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type LlmStreamRequest,
} from "../types";

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
        throw new LlmProviderError(
          "groq",
          error instanceof Error ? error.message : "Groq request failed",
          error,
        );
      }
    },

    async *stream(request: LlmStreamRequest) {
      try {
        const response = await withTransientRetry(() =>
          client.chat.completions.create({
            model,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            stream: true,
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.user },
            ],
          }),
        );

        let truncated = false;
        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) yield text;
          if (chunk.choices[0]?.finish_reason === "length") truncated = true;
        }
        if (truncated) {
          throw new LlmProviderError(
            "groq",
            "Groq hit its output limit before finishing this document.",
          );
        }
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
