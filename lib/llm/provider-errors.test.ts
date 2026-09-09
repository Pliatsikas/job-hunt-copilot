import { describe, expect, it } from "vitest";
import { httpStatusOf, isAuthFailure } from "./provider-errors";

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
