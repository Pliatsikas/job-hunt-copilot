import { z } from "zod";

export type JsonSchema = Record<string, unknown>;

/**
 * The one place a JSON schema is derived from Zod. Zod 4 does this natively,
 * so there's no second schema to keep in sync and no Zod-3-era converter in
 * the dependency tree.
 */
export function toJsonSchema(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, { target: "draft-2020-12" }) as JsonSchema;
}

/**
 * Gemini's responseSchema accepts only a subset of JSON Schema — it rejects
 * $schema, additionalProperties and similar annotations outright. Groq's
 * strict json_schema mode, by contrast, *requires* additionalProperties:false.
 * That divergence is exactly why translation lives in each provider rather
 * than in the shared layer.
 */
export function stripUnsupportedKeywords(node: unknown, drop: string[]): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => stripUnsupportedKeywords(item, drop));
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (drop.includes(key)) continue;
      out[key] = stripUnsupportedKeywords(value, drop);
    }
    return out;
  }
  return node;
}
