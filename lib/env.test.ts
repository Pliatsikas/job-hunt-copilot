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
    expect(parsed.LLM_MODEL).toBe("gemini-3.5-flash");
    expect(parsed.USER_DAILY_REQUESTS).toBe(12);
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

  it("coerces a numeric limit from a string", () => {
    const parsed = envSchema.parse({ ...validBase, USER_DAILY_REQUESTS: "25" });
    expect(parsed.USER_DAILY_REQUESTS).toBe(25);
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

  it("parses without the GitHub pair — those are optional, GitHub just stays off", () => {
    const withoutGithub: Record<string, string> = { ...validBase };
    delete withoutGithub.AUTH_GITHUB_ID;
    delete withoutGithub.AUTH_GITHUB_SECRET;

    const parsed = envSchema.parse(withoutGithub);
    expect(parsed.AUTH_GITHUB_ID).toBeUndefined();
    expect(parsed.AUTH_GITHUB_SECRET).toBeUndefined();
  });

  it("treats an empty GitHub pair as absent, the way .env.example writes them", () => {
    const parsed = envSchema.parse({
      ...validBase,
      AUTH_GITHUB_ID: "",
      AUTH_GITHUB_SECRET: "",
    });
    expect(parsed.AUTH_GITHUB_ID).toBeUndefined();
    expect(parsed.AUTH_GITHUB_SECRET).toBeUndefined();
  });
});
