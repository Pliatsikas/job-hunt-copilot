import { toJsonSchema } from "../json-schema";
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

/**
 * The mock answers by the shape it is asked for, not by guessing at the
 * prompt. A schema with a top-level `lines` array is the CV cleanup pass;
 * anything else is the analysis.
 */
function schemaHas(request: LlmRequest, key: string): boolean {
  try {
    const schema = toJsonSchema(request.schema) as { properties?: Record<string, unknown> };
    return Boolean(schema.properties && key in schema.properties);
  } catch {
    return false;
  }
}

/**
 * Deterministic "tailoring": every numbered CV line the prompt carries, in
 * order, under one heading — verbatim, which is the only thing the grounding
 * pass will accept. It exercises the exact-line check, the save and the print
 * view without a model in the loop.
 */
function tailorFromPrompt(userPrompt: string): { sections: unknown[]; keywordsAddressed: string[] } {
  const block = userPrompt.split("## The candidate's CV")[1]?.split("## The posting")[0] ?? "";
  const lines = block
    .split("\n")
    .map((l) => l.replace(/^\s*\d+\|\s?/, "").trim())
    .filter((l) => l.length >= 3 && !l.startsWith("one line per row"));
  // At least two sections and at most 40 lines in each, which is what the
  // schema demands of a real answer; the rest spill into further sections.
  const [first, ...rest] = lines;
  const headings = ["EXPERIENCE", "PROJECTS", "SKILLS", "EDUCATION", "OTHER"] as const;
  const sections: { heading: string; lines: string[] }[] = [{ heading: "PROFILE", lines: [first] }];
  for (let i = 0; i < Math.max(rest.length, 1); i += 40) {
    const chunk = rest.slice(i, i + 40);
    sections.push({ heading: headings[Math.min(i / 40, headings.length - 1)], lines: chunk.length ? chunk : [first] });
  }
  return { sections, keywordsAddressed: ["TypeScript"] };
}

function wantsCleanup(request: LlmRequest): boolean {
  try {
    const schema = toJsonSchema(request.schema) as { properties?: Record<string, unknown> };
    return Boolean(schema.properties && "lines" in schema.properties);
  } catch {
    // A test may hand in a stand-in that is not a Zod schema; that is the
    // analysis path, not a reason to fail.
    return false;
  }
}

/**
 * Deterministic "cleanup": one line per sentence of the raw text, so the
 * end-to-end test exercises the real extraction, redaction, budget and save
 * path while the model itself stays out of the network.
 */
function cleanupLines(userPrompt: string): string[] {
  const raw = userPrompt.split("## Raw text extracted from the PDF")[1]?.split("## Task")[0] ?? "";
  return raw
    .replace(/-\n(?=\p{Ll})/gu, "")
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
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
      if (schemaHas(request, "rationale")) {
        return {
          text: JSON.stringify({
            targetRoles: ["fullstack developer", "frontend developer"],
            seniority: "JUNIOR",
            city: "Thessaloniki",
            country: "Greece",
            rationale: "Mock: React and Node in production.",
          }),
          usage,
          latencyMs: 5,
        };
      }
      if (schemaHas(request, "sections")) {
        return { text: JSON.stringify(tailorFromPrompt(request.user)), usage, latencyMs: 5 };
      }
      if (wantsCleanup(request)) {
        return { text: JSON.stringify({ lines: cleanupLines(request.user) }), usage, latencyMs: 5 };
      }

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
