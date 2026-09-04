import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const validBase = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
};

describe("envSchema", () => {
  it("accepts a minimal valid env and fills in defaults", () => {
    const parsed = envSchema.parse(validBase);
    expect(parsed.LLM_PROVIDER).toBe("gemini");
    expect(parsed.LLM_MODEL).toBe("gemini-2.5-flash");
    expect(parsed.DAILY_LLM_CALL_LIMIT).toBe(50);
  });

  it("rejects a missing DATABASE_URL", () => {
    const rest: Record<string, string> = { ...validBase };
    delete rest.DATABASE_URL;
    expect(envSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a DATABASE_URL that isn't a valid URL", () => {
    const result = envSchema.safeParse({ ...validBase, DATABASE_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown LLM_PROVIDER", () => {
    const result = envSchema.safeParse({ ...validBase, LLM_PROVIDER: "openai" });
    expect(result.success).toBe(false);
  });

  it("coerces DAILY_LLM_CALL_LIMIT from a string", () => {
    const parsed = envSchema.parse({ ...validBase, DAILY_LLM_CALL_LIMIT: "25" });
    expect(parsed.DAILY_LLM_CALL_LIMIT).toBe(25);
  });

  it("accepts optional vars left empty, the way .env.example writes them", () => {
    const parsed = envSchema.parse({
      ...validBase,
      AUTH_SECRET: "",
      AUTH_GITHUB_ID: "",
      AUTH_GITHUB_SECRET: "",
      GEMINI_API_KEY: "",
      GROQ_API_KEY: "",
    });
    expect(parsed.AUTH_SECRET).toBeUndefined();
    expect(parsed.GEMINI_API_KEY).toBeUndefined();
  });
});
