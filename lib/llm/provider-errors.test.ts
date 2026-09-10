import { describe, expect, it } from "vitest";
import { failedGenerationOf, httpStatusOf, isAuthFailure, isQuotaExhausted, isSchemaValidationFailure } from "./provider-errors";

const GEMINI_BAD_KEY = new Error(
  '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}',
);

describe("httpStatusOf", () => {
  it("reads a numeric status field", () => {
    expect(httpStatusOf(Object.assign(new Error("x"), { status: 401 }))).toBe(401);
  });

  it("falls back to a code embedded in a JSON message body", () => {
    expect(httpStatusOf(GEMINI_BAD_KEY)).toBe(400);
  });

  it("returns null when there is no status to find", () => {
    expect(httpStatusOf(new Error("plain"))).toBeNull();
    expect(httpStatusOf(null)).toBeNull();
  });
});

describe("isAuthFailure", () => {
  it("recognises the real Gemini invalid-key error", () => {
    expect(isAuthFailure(GEMINI_BAD_KEY)).toBe(true);
  });

  it("treats 401 and 403 as auth failures regardless of body", () => {
    expect(isAuthFailure(Object.assign(new Error("nope"), { status: 401 }))).toBe(true);
    expect(isAuthFailure(Object.assign(new Error("nope"), { status: 403 }))).toBe(true);
  });

  it("recognises an OpenAI-style invalid_api_key on 401", () => {
    const err = Object.assign(new Error('{"error":{"code":"invalid_api_key"}}'), { status: 401 });
    expect(isAuthFailure(err)).toBe(true);
  });

  it("does NOT treat a plain 400 as an auth failure", () => {
    // Gemini returns INVALID_ARGUMENT for malformed schemas too — calling that
    // an auth problem would send you after the wrong bug entirely.
    const schemaError = new Error(
      '{"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \\"responseSchemaX\\"","status":"INVALID_ARGUMENT"}}',
    );
    expect(isAuthFailure(schemaError)).toBe(false);
  });

  it("does not treat transient failures as auth failures", () => {
    expect(isAuthFailure(Object.assign(new Error("busy"), { status: 503 }))).toBe(false);
    expect(isAuthFailure(Object.assign(new Error("slow"), { status: 429 }))).toBe(false);
  });
});

describe("isQuotaExhausted", () => {
  // The real Gemini free-tier response, which arrives as a 429 like any
  // momentary rate limit but cannot be retried away.
  const GEMINI_QUOTA = Object.assign(
    new Error(
      '{"error":{"code":429,"message":"You exceeded your current quota... Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20","status":"RESOURCE_EXHAUSTED"}}',
    ),
    { status: 429 },
  );

  it("recognises a spent daily quota", () => {
    expect(isQuotaExhausted(GEMINI_QUOTA)).toBe(true);
  });

  it("does not treat a bare 429 as quota exhaustion", () => {
    // A momentary rate limit is worth retrying; a spent quota is not.
    expect(isQuotaExhausted(Object.assign(new Error("slow down"), { status: 429 }))).toBe(false);
  });

  it("does not treat other statuses as quota exhaustion", () => {
    expect(isQuotaExhausted(Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 503 }))).toBe(false);
  });
});

describe("retry interaction", () => {
  it("a spent quota is not retried, but a plain 429 is", async () => {
    const { isTransient } = await import("./retry");
    const quota = Object.assign(new Error("RESOURCE_EXHAUSTED quota exceeded"), { status: 429 });
    const spike = Object.assign(new Error("slow down"), { status: 429 });

    expect(isTransient(quota)).toBe(false);
    expect(isTransient(spike)).toBe(true);
  });
});

describe("isSchemaValidationFailure", () => {
  const groq400 = (body: string) => Object.assign(new Error(body), { status: 400 });

  it("recognises Groq rejecting its own model's truncated output", () => {
    // The real shape, from a v2 run that overran max_tokens mid-array.
    const error = groq400(
      '400 {"error":{"message":"Generated JSON does not match the expected schema. ' +
        "Error: jsonschema: '' does not validate with /required: missing properties: " +
        "'keywordsToMirror', 'redFlags', 'likelyQuestions'\",\"code\":\"json_validate_failed\"}}",
    );
    expect(isSchemaValidationFailure(error)).toBe(true);
  });

  it("does not claim a rejected key as a schema problem", () => {
    const error = groq400('400 {"error":{"message":"Invalid API key","code":"invalid_api_key"}}');
    expect(isSchemaValidationFailure(error)).toBe(false);
    expect(isAuthFailure(error)).toBe(true);
  });

  it("ignores a 429, which is about rate rather than shape", () => {
    const error = Object.assign(new Error("json_validate_failed"), { status: 429 });
    expect(isSchemaValidationFailure(error)).toBe(false);
  });
});

describe("failedGenerationOf", () => {
  it("unescapes the partial output so it can be quoted back in a repair", () => {
    const error = Object.assign(
      new Error('400 {"error":{"failed_generation":"{\\n  \\"matchScore\\": 45,\\n  \\"gaps\\": ["}}'),
      { status: 400 },
    );
    expect(failedGenerationOf(error)).toBe('{\n  "matchScore": 45,\n  "gaps": [');
  });

  it("returns null when the provider reports no partial output", () => {
    expect(failedGenerationOf(new Error("plain failure"))).toBeNull();
  });
});
