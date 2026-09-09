import { describe, expect, it, vi } from "vitest";
import { isTransient, withTransientRetry } from "./retry";

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe("isTransient", () => {
  it.each([429, 500, 502, 503, 504])("treats %i as transient", (status) => {
    expect(isTransient(httpError(status))).toBe(true);
  });

  it.each([400, 401, 403, 404, 422])("treats %i as permanent", (status) => {
    expect(isTransient(httpError(status))).toBe(false);
  });

  it("reads the status out of a JSON message body when there is no status field", () => {
    // Gemini surfaces 503s this way.
    const error = new Error('{"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}');
    expect(isTransient(error)).toBe(true);
  });

  it("does not treat an unrecognised error as transient", () => {
    expect(isTransient(new Error("something else"))).toBe(false);
    expect(isTransient(null)).toBe(false);
  });
});

describe("withTransientRetry", () => {
  it("returns immediately on success", async () => {
    const op = vi.fn(async () => "ok");
    expect(await withTransientRetry(op)).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and succeeds", async () => {
    let calls = 0;
    const op = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw httpError(503);
      return "recovered";
    });

    // Two attempts, one 1s backoff — keep the real timer but keep it short.
    expect(await withTransientRetry(op, 2)).toBe("recovered");
    expect(op).toHaveBeenCalledTimes(2);
  }, 10_000);

  it("does not retry a permanent failure", async () => {
    const op = vi.fn(async () => {
      throw httpError(400);
    });

    await expect(withTransientRetry(op)).rejects.toThrow("HTTP 400");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempt limit and rethrows the last error", async () => {
    const op = vi.fn(async () => {
      throw httpError(503);
    });

    await expect(withTransientRetry(op, 2)).rejects.toThrow("HTTP 503");
    expect(op).toHaveBeenCalledTimes(2);
  }, 10_000);
});
