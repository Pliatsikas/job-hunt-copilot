import { GoogleGenAI } from "@google/genai";
import { stripUnsupportedKeywords, toJsonSchema } from "../json-schema";
import { isAuthFailure } from "../provider-errors";
import { withTransientRetry } from "../retry";
import {
  LlmAuthError,
  LlmProviderError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
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
        if (isAuthFailure(error)) throw new LlmAuthError("gemini", "GEMINI_API_KEY", error);
        throw new LlmProviderError(
          "gemini",
          error instanceof Error ? error.message : "Gemini request failed",
          error,
        );
      }
    },
  };
}
