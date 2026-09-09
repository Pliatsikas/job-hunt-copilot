import { env } from "../env";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import type { LlmProvider } from "./types";

/** Default model per provider, used when LLM_MODEL isn't overridden. */
const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-3.5-flash",
  groq: "llama-3.3-70b-versatile",
};

/**
 * Feature code calls this and never learns which provider answered.
 * Adding a provider means registering it here and passing the conformance
 * suite in lib/llm/conformance.test.ts — nothing else.
 */
export function getProvider(): LlmProvider {
  const name = env.LLM_PROVIDER;
  const model = env.LLM_MODEL || DEFAULT_MODELS[name];

  switch (name) {
    case "gemini": {
      if (!env.GEMINI_API_KEY) {
        throw new Error("LLM_PROVIDER=gemini but GEMINI_API_KEY is not set");
      }
      return createGeminiProvider(env.GEMINI_API_KEY, model);
    }
    case "groq": {
      if (!env.GROQ_API_KEY) {
        throw new Error("LLM_PROVIDER=groq but GROQ_API_KEY is not set");
      }
      return createGroqProvider(env.GROQ_API_KEY, model);
    }
    default:
      // ollama/anthropic are declared in the env enum but not implemented yet;
      // failing loudly beats silently falling back to a different model.
      throw new Error(`LLM_PROVIDER=${name} is not implemented yet`);
  }
}
