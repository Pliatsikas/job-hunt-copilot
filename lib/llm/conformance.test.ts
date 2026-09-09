import "dotenv/config";
import { describe, expect, it } from "vitest";
import { analysisResultSchema } from "../schemas/analysis";
import { FIXTURE_CV, FIXTURE_JOB_DESCRIPTION, FIXTURE_SKILLS } from "./fixtures";
import { stripUnsupportedKeywords, toJsonSchema } from "./json-schema";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import * as analyzePrompt from "./prompts/analyze.v1";
import { completeWithRepair } from "./repair";
import type { LlmProvider } from "./types";

/**
 * The registry every provider must appear in. Adding a provider means adding a
 * row here and making this file pass — nothing else.
 */
const PROVIDERS: {
  name: string;
  envKey: "GEMINI_API_KEY" | "GROQ_API_KEY";
  defaultModel: string;
  create: (apiKey: string, model: string) => LlmProvider;
}[] = [
  {
    name: "gemini",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-3.5-flash",
    create: createGeminiProvider,
  },
  {
    name: "groq",
    envKey: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    create: createGroqProvider,
  },
];

describe("provider contract", () => {
  it.each(PROVIDERS)("$name exposes name and model", ({ create, name, defaultModel }) => {
    const provider = create("test-key", defaultModel);
    expect(provider.name).toBe(name);
    expect(provider.model).toBe(defaultModel);
    expect(typeof provider.complete).toBe("function");
  });
});

describe("schema translation", () => {
  const jsonSchema = toJsonSchema(analysisResultSchema);

  it("derives the JSON schema from Zod, with every field required", () => {
    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.required).toEqual(
      expect.arrayContaining([
        "matchScore",
        "verdict",
        "summary",
        "matchedSkills",
        "gaps",
        "keywordsToMirror",
        "redFlags",
        "likelyQuestions",
      ]),
    );
  });

  it("keeps the constraints that matter to the model", () => {
    const properties = jsonSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties.matchScore).toMatchObject({ minimum: 0, maximum: 100 });
    expect(properties.keywordsToMirror).toMatchObject({ maxItems: 15 });
    expect(properties.likelyQuestions).toMatchObject({ maxItems: 8 });
  });

  it("groq keeps additionalProperties:false, which strict mode requires", () => {
    expect(jsonSchema.additionalProperties).toBe(false);
  });

  it("gemini strips the keywords its responseSchema rejects", () => {
    const cleaned = stripUnsupportedKeywords(jsonSchema, [
      "$schema",
      "additionalProperties",
      "$ref",
      "definitions",
      "$defs",
    ]);
    const serialized = JSON.stringify(cleaned);

    expect(serialized).not.toContain("$schema");
    expect(serialized).not.toContain("additionalProperties");
    // The parts the model actually needs survive the strip.
    expect(serialized).toContain("matchScore");
    expect(serialized).toContain("evidenceFromCv");
  });
});

/**
 * Live cross-provider run. Opt-in: it costs real quota, so it needs both an
 * API key and LLM_LIVE_TEST=1. CI has neither, so it skips there.
 */
const live = process.env.LLM_LIVE_TEST === "1";

describe.skipIf(!live)("live conformance", () => {
  for (const entry of PROVIDERS) {
    const apiKey = process.env[entry.envKey];

    it.skipIf(!apiKey)(
      `${entry.name} returns something that satisfies the schema`,
      async () => {
        const provider = entry.create(apiKey!, entry.defaultModel);

        const out = await completeWithRepair(
          provider,
          {
            system: analyzePrompt.system,
            user: analyzePrompt.buildUserPrompt({
              cvText: FIXTURE_CV,
              skills: FIXTURE_SKILLS,
              jobDescription: FIXTURE_JOB_DESCRIPTION,
            }),
            temperature: 0.2,
            maxTokens: 4096,
          },
          analysisResultSchema,
        );

        expect(analysisResultSchema.safeParse(out.data).success).toBe(true);
        expect(out.data.matchScore).toBeGreaterThanOrEqual(0);
        expect(out.data.matchScore).toBeLessThanOrEqual(100);
        expect(out.usage.inputTokens).toBeTypeOf("number");
        expect(out.latencyMs).toBeGreaterThan(0);
      },
      120_000,
    );
  }
});
