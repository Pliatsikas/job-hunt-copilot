import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../lib/env";
import { groundAnalysis } from "../lib/llm/grounding";
import { findFabricatedClaims } from "../lib/llm/fabrication";
import * as analyzePrompt from "../lib/llm/prompts/analyze.v2";
import * as coverLetterPrompt from "../lib/llm/prompts/cover-letter.v1";
import { createGeminiProvider } from "../lib/llm/providers/gemini";
import { createGroqProvider } from "../lib/llm/providers/groq";
import { AnalysisError, completeWithRepair } from "../lib/llm/repair";
import { drainStream, LlmQuotaError, type LlmProvider } from "../lib/llm/types";
import {
  analysisResultSchema,
  type AnalysisResult,
} from "../lib/schemas/analysis";
import type {
  AnalysisFixture,
  CoverLetterFixture,
  EvalFixture,
} from "../lib/schemas/eval";
import {
  candidateFor,
  loadCandidate,
  loadFixtures,
  needsSharedCandidate,
  RESULTS_DIR,
} from "./load";
import { mean, pct, scoreFixture, type FixtureScore } from "./metrics";

/**
 * Gemini's free tier caps requests per *model* per day — measured at 20 for
 * gemini-3.5-flash — so a sweep that fires every fixture at one model exhausts
 * it partway through and leaves a half-finished table. Sibling models draw on
 * separate buckets, so the runner rotates through them and records which model
 * produced which row: without that, a "before/after prompt version" comparison
 * is silently comparing two models (NOTES.md, M9 eval planning).
 */
const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];
const GROQ_MODELS = ["openai/gpt-oss-120b"];

type ProviderName = "groq" | "gemini";

type Args = { provider: ProviderName; dryRun: boolean; only: string | null };

function parseArgs(argv: string[]): Args {
  const provider = (value(argv, "--provider") ?? env.LLM_PROVIDER) as string;
  if (provider !== "groq" && provider !== "gemini") {
    throw new Error(`--provider must be groq or gemini (got "${provider}")`);
  }
  return {
    provider,
    dryRun: argv.includes("--dry-run"),
    only: value(argv, "--only"),
  };
}

function value(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  const next = argv[index + 1];
  if (!next || next.startsWith("--")) throw new Error(`${flag} needs a value`);
  return next;
}

function modelsFor(provider: ProviderName): string[] {
  return provider === "gemini" ? GEMINI_MODELS : GROQ_MODELS;
}

function makeProvider(provider: ProviderName, model: string): LlmProvider {
  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
    return createGeminiProvider(env.GEMINI_API_KEY, model);
  }
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
  return createGroqProvider(env.GROQ_API_KEY, model);
}

type Row = {
  id: string;
  kind: EvalFixture["kind"];
  model: string;
  ok: boolean;
  error: string | null;
  matchScore: number | null;
  droppedClaims: number | null;
  attempts: number | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  score: FixtureScore | null;
  fabrications: string[] | null;
};

async function runAnalysis(
  fixture: AnalysisFixture,
  provider: LlmProvider,
  cvText: string,
  skills: string[],
): Promise<Row> {
  const base: Row = {
    id: fixture.id,
    kind: fixture.kind,
    model: provider.model,
    ok: false,
    error: null,
    matchScore: null,
    droppedClaims: null,
    attempts: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    score: null,
    fabrications: null,
  };

  try {
    const out = await completeWithRepair(
      provider,
      {
        system: analyzePrompt.system,
        user: analyzePrompt.buildUserPrompt({
          cvText,
          skills,
          jobDescription: fixture.jobDescription,
        }),
        temperature: 0.2,
        maxTokens: 4096,
      },
      analysisResultSchema,
    );

    const { result, droppedClaims } = groundAnalysis(
      out.data as AnalysisResult,
      cvText,
    );

    return {
      ...base,
      ok: true,
      matchScore: result.matchScore,
      droppedClaims,
      attempts: out.attempts,
      latencyMs: out.latencyMs,
      inputTokens: out.usage.inputTokens,
      outputTokens: out.usage.outputTokens,
      score: scoreFixture(fixture, result),
    };
  } catch (error) {
    if (error instanceof LlmQuotaError) throw error;
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runCoverLetter(
  fixture: CoverLetterFixture,
  provider: LlmProvider,
  cvText: string,
): Promise<Row> {
  const base: Row = {
    id: fixture.id,
    kind: fixture.kind,
    model: provider.model,
    ok: false,
    error: null,
    matchScore: null,
    droppedClaims: null,
    attempts: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    score: null,
    fabrications: null,
  };

  try {
    const analysis = analysisResultSchema.safeParse(fixture.analysis);
    const startedAt = Date.now();
    let text = "";
    const usage = await drainStream(
      provider.stream({
        system: coverLetterPrompt.system,
        user: coverLetterPrompt.buildUserPrompt({
          cvText,
          jobDescription: fixture.jobDescription,
          roleTitle: fixture.roleTitle,
          companyName: fixture.companyName,
          analysis: analysis.success ? analysis.data : null,
          language: fixture.language,
          tone: "direct",
          length: "short",
        }),
        temperature: 0.7,
        maxTokens: 2000,
      }),
      (chunk) => {
        text += chunk;
      },
    );

    const findings = findFabricatedClaims(text, fixture.absentSkills);
    return {
      ...base,
      ok: findings.length === 0,
      error: findings.length ? `${findings.length} fabricated claim(s)` : null,
      attempts: 1,
      latencyMs: Date.now() - startedAt,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      fabrications: findings.map((f) => f.sentence ?? JSON.stringify(f)),
    };
  } catch (error) {
    if (error instanceof LlmQuotaError) throw error;
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const all = await loadFixtures();
  const fixtures = args.only ? all.filter((f) => f.id === args.only) : all;
  if (!fixtures.length)
    throw new Error(
      args.only ? `No fixture with id "${args.only}"` : "No fixtures",
    );

  const models = modelsFor(args.provider);
  const analyses = fixtures.filter((f) => f.kind === "analysis").length;

  // Said up front, before anything is spent (SPEC.md §6.1 / M8).
  console.log(`Prompt version : ${analyzePrompt.version}`);
  console.log(`Provider       : ${args.provider}`);
  console.log(`Models         : ${models.join(", ")}`);
  console.log(
    `Fixtures       : ${fixtures.length} (${analyses} analysis, ${fixtures.length - analyses} cover letter)`,
  );
  const plural = fixtures.length === 1 ? "request" : "requests";
  console.log(
    `Cost           : ${fixtures.length} ${plural} minimum, up to ${fixtures.length * 2} if every one needs its single repair`,
  );
  if (args.provider === "gemini") {
    const perModel = Math.ceil(fixtures.length / models.length);
    console.log(
      `                 spread over ${models.length} sibling models, ~${perModel} each against a measured 20/day per model`,
    );
  } else {
    console.log(
      `                 against a measured 1,000/day; roughly ${((fixtures.length / 1000) * 100).toFixed(1)}% of the daily budget`,
    );
  }

  if (args.dryRun) {
    console.log("\n--dry-run: fixtures validated, nothing called.");
    return;
  }

  // Only when something actually needs it: the M5 regression case carries its
  // own CV, and should not be blocked on a file it never reads.
  const candidate = needsSharedCandidate(fixtures)
    ? await loadCandidate()
    : null;
  console.log(`CV             : ${candidate?.label ?? "per-fixture only"}\n`);

  const rows: Row[] = [];
  for (const [index, fixture] of fixtures.entries()) {
    const model = models[index % models.length];
    const provider = makeProvider(args.provider, model);
    const { cvText, skills } = candidateFor(fixture, candidate);

    process.stdout.write(`  ${fixture.id} (${model}) … `);
    const row =
      fixture.kind === "analysis"
        ? await runAnalysis(fixture, provider, cvText, skills)
        : await runCoverLetter(fixture, provider, cvText);
    rows.push(row);
    console.log(
      row.ok ? `ok  score=${row.matchScore ?? "—"}` : `FAILED  ${row.error}`,
    );
  }

  report(rows);
  await write(rows, args.provider);
}

function report(rows: Row[]) {
  const analysis = rows.filter((r) => r.kind === "analysis");
  const scored = analysis.filter((r) => r.score);
  const valid = analysis.filter((r) => r.ok);
  const letters = rows.filter((r) => r.kind === "cover_letter");

  console.log("\n" + "=".repeat(64));

  // An empty section reports nothing, not zero: "recall 0%" with no analysis
  // fixtures loaded reads as a failing model rather than an unmeasured one.
  if (!analysis.length) {
    console.log("no analysis fixtures loaded — nothing to score");
  } else {
    console.log(
      `schema-valid          ${valid.length}/${analysis.length}  (${pct(valid.length / analysis.length)})`,
    );
    console.log(
      `in expected range     ${scored.filter((r) => r.score!.inRange).length}/${scored.length}`,
    );
    console.log(
      `mean score deviation  ${mean(scored.map((r) => r.score!.scoreDeviation)).toFixed(1)} points outside the band`,
    );
    console.log(
      `mustFindSkills recall ${pct(mean(scored.map((r) => r.score!.skillRecall)))}`,
    );
    const gapScored = scored.filter((r) => r.score!.gapRecall !== null);
    if (gapScored.length) {
      console.log(
        `mustFlagGaps recall   ${pct(mean(gapScored.map((r) => r.score!.gapRecall!)))}`,
      );
    }
    console.log(
      `droppedClaims         ${analysis.reduce((s, r) => s + (r.droppedClaims ?? 0), 0)} total, ${mean(analysis.map((r) => r.droppedClaims ?? 0)).toFixed(2)} mean`,
    );
    console.log(
      `repairs needed        ${analysis.filter((r) => (r.attempts ?? 1) > 1).length}/${analysis.length}`,
    );
    console.log(
      `wordy gap entries     ${scored.reduce((s, r) => s + r.score!.wordyGaps.length, 0)}  (analyze@2 should hold this at 0)`,
    );
  }
  console.log(
    `mean latency          ${(mean(rows.filter((r) => r.latencyMs).map((r) => r.latencyMs!)) / 1000).toFixed(1)}s`,
  );
  console.log(
    `mean tokens           ${mean(rows.map((r) => (r.inputTokens ?? 0) + (r.outputTokens ?? 0))).toFixed(0)}  (${rows.reduce((s, r) => s + (r.inputTokens ?? 0) + (r.outputTokens ?? 0), 0)} total)`,
  );
  if (letters.length) {
    console.log(
      `fabrication check     ${letters.filter((r) => r.ok).length}/${letters.length} clean`,
    );
  }

  const missed = scored.flatMap((r) =>
    r.score!.missedSkills.map((s) => `${r.id}: ${s}`),
  );
  if (missed.length) {
    console.log(`\nmissed mustFindSkills:\n  ${missed.join("\n  ")}`);
  }
  const failed = rows.filter((r) => !r.ok);
  if (failed.length) {
    console.log(
      `\nfailures:\n  ${failed.map((r) => `${r.id}: ${r.error}`).join("\n  ")}`,
    );
  }
  console.log("=".repeat(64));
}

async function write(rows: Row[], provider: ProviderName) {
  await mkdir(RESULTS_DIR, { recursive: true });
  const file = join(
    RESULTS_DIR,
    `${analyzePrompt.version.replace("@", "-")}-${provider}.json`,
  );
  await writeFile(
    file,
    JSON.stringify(
      {
        promptVersion: analyzePrompt.version,
        provider,
        ranAt: new Date().toISOString(),
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\nwritten: ${file.replace(process.cwd() + "/", "")}`);
}

main().catch((error) => {
  console.error(`\n${error instanceof AnalysisError ? error.message : error}`);
  process.exitCode = 1;
});
