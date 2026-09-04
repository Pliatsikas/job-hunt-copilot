import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const validBase = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
  AUTH_SECRET: "test-secret",
  AUTH_GITHUB_ID: "test-github-id",
  AUTH_GITHUB_SECRET: "test-github-secret",
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

  it("accepts LLM vars left empty, the way .env.example writes them", () => {
    const parsed = envSchema.parse({
      ...validBase,
      GEMINI_API_KEY: "",
      GROQ_API_KEY: "",
    });
    expect(parsed.GEMINI_API_KEY).toBeUndefined();
    expect(parsed.GROQ_API_KEY).toBeUndefined();
  });

  it("rejects an empty AUTH_SECRET now that M1 requires it", () => {
    const result = envSchema.safeParse({ ...validBase, AUTH_SECRET: "" });
    expect(result.success).toBe(false);
  });
});
