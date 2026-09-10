import { afterEach, describe, expect, it } from "vitest";
import { createMockProvider } from "./mock";

const saved = { allow: process.env.ALLOW_MOCK_LLM, vercel: process.env.VERCEL };

afterEach(() => {
  process.env.ALLOW_MOCK_LLM = saved.allow;
  if (saved.vercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = saved.vercel;
});

describe("the mock provider's guards", () => {
  it("refuses without the explicit opt-in", () => {
    delete process.env.ALLOW_MOCK_LLM;
    expect(() => createMockProvider()).toThrow(/ALLOW_MOCK_LLM=true/);
  });

  it("refuses on the deployment platform even with the opt-in set", () => {
    process.env.ALLOW_MOCK_LLM = "true";
    process.env.VERCEL = "1";
    expect(() => createMockProvider()).toThrow(/never be enabled on a deployment/);
  });

  it("constructs when both conditions hold", () => {
    process.env.ALLOW_MOCK_LLM = "true";
    delete process.env.VERCEL;
    expect(createMockProvider().name).toBe("mock");
  });
});

describe("the mock's evidence", () => {
  it("quotes the CV it was given, so grounding does real work", async () => {
    process.env.ALLOW_MOCK_LLM = "true";
    delete process.env.VERCEL;
    const cvLine = "I design PostgreSQL schemas and write REST APIs in Node.js.";

    const out = await createMockProvider().complete({
      system: "s",
      user: `## Candidate CV\n${cvLine}\n\n## Job description\nanything`,
      schema: { safeParse: () => ({ success: true }) } as never,
    });

    // A mock with hard-coded evidence would be dropped by the grounding pass,
    // and the E2E test would pass while proving nothing.
    expect(JSON.parse(out.text).matchedSkills[0].evidenceFromCv).toBe(cvLine);
  });
});
