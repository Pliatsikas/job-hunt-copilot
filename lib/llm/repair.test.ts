import { describe, expect, it, vi } from "vitest";
import { analysisResultSchema } from "../schemas/analysis";
import { VALID_RESULT } from "./fixtures";
import { AnalysisError, completeWithRepair, extractJson } from "./repair";
import { LlmSchemaError, NO_USAGE, type LlmProvider, type LlmResult } from "./types";

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
      return NO_USAGE;
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

describe("provider-side schema rejection", () => {
  const rejection = () =>
    new LlmSchemaError("groq", "Groq rejected the model's output", '{"matchScore": 45, "gaps": [');

  it("repairs once instead of retrying the identical request", async () => {
    // Groq's strict mode validates before returning, so bad output arrives as
    // a 400. Backing off and repeating the same prompt would reproduce it;
    // the repair attempt carries the complaint and can succeed.
    let call = 0;
    const provider: LlmProvider = {
      name: "groq",
      model: "test",
      async complete() {
        call += 1;
        if (call === 1) throw rejection();
        return reply(JSON.stringify(VALID_RESULT));
      },
      async *stream() {
        yield "";
        return NO_USAGE;
      },
    };

    const out = await completeWithRepair(provider, request, analysisResultSchema);

    expect(call).toBe(2);
    expect(out.attempts).toBe(2);
    expect(analysisResultSchema.safeParse(out.data).success).toBe(true);
  });

  it("quotes the rejected partial output back in the repair prompt", async () => {
    const prompts: string[] = [];
    let call = 0;
    const provider: LlmProvider = {
      name: "groq",
      model: "test",
      async complete(req) {
        call += 1;
        prompts.push(req.user);
        if (call === 1) throw rejection();
        return reply(JSON.stringify(VALID_RESULT));
      },
      async *stream() {
        yield "";
        return NO_USAGE;
      },
    };

    await completeWithRepair(provider, request, analysisResultSchema);

    expect(prompts[1]).toContain("It stopped here");
    expect(prompts[1]).toContain('"matchScore": 45');
    expect(prompts[1]).toContain("fewer, better entries");
  });

  it("counts the rejected call — the provider billed for it", async () => {
    const counted: unknown[] = [];
    let call = 0;
    const provider: LlmProvider = {
      name: "groq",
      model: "test",
      async complete() {
        call += 1;
        if (call === 1) throw rejection();
        return reply(JSON.stringify(VALID_RESULT));
      },
      async *stream() {
        yield "";
        return NO_USAGE;
      },
    };

    await completeWithRepair(provider, request, analysisResultSchema, async (usage) => {
      counted.push(usage);
    });

    expect(counted).toHaveLength(2);
  });

  it("gives up after one repair and saves nothing", async () => {
    const provider: LlmProvider = {
      name: "groq",
      model: "test",
      async complete() {
        throw rejection();
      },
      async *stream() {
        yield "";
        return NO_USAGE;
      },
    };

    await expect(completeWithRepair(provider, request, analysisResultSchema)).rejects.toThrow(
      LlmSchemaError,
    );
  });

  it("lets a genuine transport failure through to the retry layer", async () => {
    const provider: LlmProvider = {
      name: "groq",
      model: "test",
      async complete() {
        throw new Error("socket hang up");
      },
      async *stream() {
        yield "";
        return NO_USAGE;
      },
    };

    await expect(completeWithRepair(provider, request, analysisResultSchema)).rejects.toThrow(
      "socket hang up",
    );
  });
});
