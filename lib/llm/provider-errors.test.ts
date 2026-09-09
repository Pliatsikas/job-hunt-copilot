import { describe, expect, it } from "vitest";
import { httpStatusOf, isAuthFailure, isQuotaExhausted } from "./provider-errors";

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
