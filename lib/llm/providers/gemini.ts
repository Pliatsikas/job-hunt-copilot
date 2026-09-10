import { GoogleGenAI } from "@google/genai";
import { stripUnsupportedKeywords, toJsonSchema } from "../json-schema";
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
  type LlmUsage,
  NO_USAGE,
} from "../types";

// Gemini's responseSchema is an OpenAPI subset: these annotations make it
// reject the request outright.
const UNSUPPORTED = ["$schema", "additionalProperties", "$ref", "definitions", "$defs"];

export function createGeminiProvider(apiKey: string, model: string): LlmProvider {
  const client = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",
    model,

    async complete(request: LlmRequest): Promise<LlmResult> {
      const responseSchema = stripUnsupportedKeywords(toJsonSchema(request.schema), UNSUPPORTED);
      const startedAt = Date.now();

      try {
        const response = await withTransientRetry(() =>
          client.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          config: {
            systemInstruction: request.system,
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens,
            // Native structured output — the model is constrained, rather than
            // asked politely to emit JSON.
            responseMimeType: "application/json",
            responseSchema,
            },
          }),
        );

        const text = response.text ?? "";
        if (!text.trim()) {
          throw new LlmProviderError("gemini", "Gemini returned an empty response");
        }
        if (response.candidates?.[0]?.finishReason === "MAX_TOKENS") {
          // Silently returning truncated JSON would look like a schema failure
          // and burn the repair attempt on an unfixable cause.
          throw new LlmProviderError(
            "gemini",
            "Gemini hit its output limit before finishing. Try a shorter job description.",
          );
        }

        return {
          text,
          usage: {
            inputTokens: response.usageMetadata?.promptTokenCount ?? null,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
          },
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        if (error instanceof LlmProviderError) throw error;
        // Named here, where the provider knows which variable holds its key.
        if (isQuotaExhausted(error)) throw new LlmQuotaError("gemini", model, error);
        if (isAuthFailure(error)) throw new LlmAuthError("gemini", "GEMINI_API_KEY", error);
        throw new LlmProviderError(
          "gemini",
          error instanceof Error ? error.message : "Gemini request failed",
          error,
        );
      }
    },

    async *stream(request: LlmStreamRequest): AsyncGenerator<string, LlmUsage, void> {
      try {
        const response = await withTransientRetry(() =>
          client.models.generateContentStream({
            model,
            contents: [{ role: "user", parts: [{ text: request.user }] }],
            config: {
              systemInstruction: request.system,
              temperature: request.temperature,
              maxOutputTokens: request.maxTokens,
              // Gemini 3.x reasons by default and its thinking expands to fill
              // whatever budget it is given — measured at 3,974 of 4,000
              // tokens, leaving 40 for the answer. Prose needs no reasoning
              // trace, so it is switched off here. complete() keeps it: the
              // structured analysis genuinely benefits.
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        );

        let truncated = false;
        // usageMetadata is cumulative and repeated on chunks; the last one
        // wins rather than being summed.
        let usage: LlmUsage = NO_USAGE;
        for await (const chunk of response) {
          const text = chunk.text;
          if (text) yield text;
          if (chunk.candidates?.[0]?.finishReason === "MAX_TOKENS") truncated = true;
          if (chunk.usageMetadata) {
            usage = {
              inputTokens: chunk.usageMetadata.promptTokenCount ?? null,
              outputTokens: chunk.usageMetadata.candidatesTokenCount ?? null,
            };
          }
        }
        if (truncated) {
          throw new LlmProviderError(
            "gemini",
            "Gemini hit its output limit before finishing this document.",
          );
        }
        return usage;
      } catch (error) {
        if (isQuotaExhausted(error)) throw new LlmQuotaError("gemini", model, error);
        if (isAuthFailure(error)) throw new LlmAuthError("gemini", "GEMINI_API_KEY", error);
        throw new LlmProviderError(
          "gemini",
          error instanceof Error ? error.message : "Gemini stream failed",
          error,
        );
      }
    },
  };
}
