import type { LlmProvider, LlmRequest, LlmResult, LlmStreamRequest, LlmUsage } from "../types";

/**
 * A provider that answers without a network call, so the end-to-end test can
 * exercise the real analyze action, the real grounding check, the real
 * transaction and the real streaming route — everything except the model.
 *
 * The LLM call happens on the server, so Playwright's request interception
 * cannot reach it; the seam has to exist in the application.
 *
 * Two independent things must be true before it will construct, and neither
 * is true of a deployment. NODE_ENV was not enough on its own: the end-to-end
 * suite runs a production *build* (deliberately — `next dev` overlays and
 * recompiles are the usual source of flake), so NODE_ENV is "production"
 * there too, and guarding on it alone refused the one legitimate caller while
 * still permitting a self-hosted deployment that happened to set
 * LLM_PROVIDER=mock.
 */

/**
 * Evidence is lifted out of the CV in the prompt rather than hard-coded, so
 * the grounding check does real work: a substring that isn't in the CV would
 * be dropped, and a mock that always got dropped would make the test pass
 * while proving nothing.
 */
function quoteFromCv(userPrompt: string): string {
  const section = userPrompt.split("## Candidate CV")[1] ?? "";
  const body = section.split("##")[0] ?? "";
  const line = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 20);
  return line ?? "no CV line long enough to quote";
}

export function createMockProvider(model = "mock-1"): LlmProvider {
  // 1. An explicit opt-in, which nothing sets by accident.
  if (process.env.ALLOW_MOCK_LLM !== "true") {
    throw new Error(
      "LLM_PROVIDER=mock also requires ALLOW_MOCK_LLM=true. It is a test seam: " +
        "serving fixtures to real users would look exactly like the app working.",
    );
  }
  // 2. Never on the deployment platform, whatever the flags say.
  if (process.env.VERCEL) {
    throw new Error("LLM_PROVIDER=mock must never be enabled on a deployment.");
  }

  const usage: LlmUsage = { inputTokens: 1200, outputTokens: 400 };

  return {
    name: "mock",
    model,

    async complete(request: LlmRequest): Promise<LlmResult> {
      const evidence = quoteFromCv(request.user);

      return {
        text: JSON.stringify({
          matchScore: 62,
          verdict: "worth_applying",
          summary: "Deterministic assessment from the mock provider, for end-to-end tests.",
          matchedSkills: [{ skill: "typescript", evidenceFromCv: evidence }],
          gaps: [
            {
              skill: "Kubernetes",
              severity: "blocker",
              howToBridge: "Deploy an existing Docker service to a small managed cluster.",
            },
          ],
          keywordsToMirror: ["TypeScript", "React"],
          redFlags: ["3+ years of experience required"],
          likelyQuestions: ["Walk me through a schema you designed."],
        }),
        usage,
        latencyMs: 5,
      };
    },

    async *stream(_request: LlmStreamRequest): AsyncGenerator<string, LlmUsage, void> {
      // Chunked deliberately: the route assembles the document from the pieces
      // it receives, and a single-chunk mock would not exercise that.
      for (const chunk of [
        "Dear Hiring Team,\n\n",
        "I build production applications with TypeScript and React. ",
        "Kubernetes is a gap I would close early.\n\n",
        "Kind regards,\nTest User",
      ]) {
        yield chunk;
      }
      return usage;
    },
  };
}
