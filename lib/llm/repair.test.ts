import { describe, expect, it, vi } from "vitest";
import { analysisResultSchema } from "../schemas/analysis";
import { VALID_RESULT } from "./fixtures";
import { AnalysisError, completeWithRepair, extractJson } from "./repair";
import type { LlmProvider, LlmResult } from "./types";

function reply(text: string, tokens = 10): LlmResult {
  return { text, usage: { inputTokens: tokens, outputTokens: tokens }, latencyMs: 100 };
}

function providerReturning(...replies: LlmResult[]): LlmProvider & { calls: number } {
  let index = 0;
  const provider = {
    name: "fake",
    model: "fake-1",
    calls: 0,
    async complete() {
      provider.calls += 1;
      return replies[Math.min(index++, replies.length - 1)];
    },
    // Unused here — repair only concerns the non-streaming path.
    async *stream() {
      yield "";
    },
  };
  return provider;
}

const request = { system: "s", user: "u" };

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("digs the object out of a fenced or chatty reply", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("throws when there is no object at all", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("completeWithRepair", () => {
  it("returns on the first attempt when the response is valid", async () => {
    const provider = providerReturning(reply(JSON.stringify(VALID_RESULT)));

    const out = await completeWithRepair(provider, request, analysisResultSchema);

    expect(out.attempts).toBe(1);
    expect(provider.calls).toBe(1);
    expect(out.data.matchScore).toBe(VALID_RESULT.matchScore);
  });

  it("repairs exactly once when the first reply is malformed", async () => {
    // matchScore out of range — well-formed JSON, invalid against the schema.
    const malformed = JSON.stringify({ ...VALID_RESULT, matchScore: 250 });
    const provider = providerReturning(reply(malformed), reply(JSON.stringify(VALID_RESULT)));

    const out = await completeWithRepair(provider, request, analysisResultSchema);

    expect(out.attempts).toBe(2);
    expect(provider.calls).toBe(2);
    expect(out.data.matchScore).toBe(VALID_RESULT.matchScore);
  });

  it("puts the validation error into the repair prompt", async () => {
    const provider = providerReturning(
      reply(JSON.stringify({ ...VALID_RESULT, verdict: "nonsense" })),
      reply(JSON.stringify(VALID_RESULT)),
    );
    const spy = vi.spyOn(provider, "complete");

    await completeWithRepair(provider, request, analysisResultSchema);

    const repairPrompt = spy.mock.calls[1][0].user;
    expect(repairPrompt).toContain("previous reply was rejected");
    expect(repairPrompt).toContain("verdict");
  });

  it("gives up after the second failure and throws AnalysisError", async () => {
    const provider = providerReturning(reply('{"broken":true}'));

    await expect(completeWithRepair(provider, request, analysisResultSchema)).rejects.toThrow(
      AnalysisError,
    );
    // Exactly one repair — not a retry loop.
    expect(provider.calls).toBe(2);
  });

  it("recovers from unparseable JSON via the repair attempt", async () => {
    const provider = providerReturning(reply("I'm afraid I can't do that"), reply(JSON.stringify(VALID_RESULT)));

    const out = await completeWithRepair(provider, request, analysisResultSchema);
    expect(out.attempts).toBe(2);
  });

  it("sums usage and latency across both attempts, since both cost quota", async () => {
    const provider = providerReturning(reply('{"broken":true}', 10), reply(JSON.stringify(VALID_RESULT), 30));

    const out = await completeWithRepair(provider, request, analysisResultSchema);

    expect(out.usage.inputTokens).toBe(40);
    expect(out.usage.outputTokens).toBe(40);
    expect(out.latencyMs).toBe(200);
  });

  it("counts every provider call, including the repair", async () => {
    const provider = providerReturning(reply('{"broken":true}'), reply(JSON.stringify(VALID_RESULT)));
    const onCall = vi.fn(async () => {});

    await completeWithRepair(provider, request, analysisResultSchema, onCall);

    expect(onCall).toHaveBeenCalledTimes(2);
  });
});
