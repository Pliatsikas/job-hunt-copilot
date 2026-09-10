import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
import { analysisResultSchema, type AnalysisResult } from "../lib/schemas/analysis";
import type { AnalysisFixture, CoverLetterFixture, EvalFixture } from "../lib/schemas/eval";
import {
  candidateFor,
  loadCandidate,
  loadFixtures,
  needsSharedCandidate,
  RESULTS_DIR,
} from "./load";
import { mean, median, pct, scoreFixture, spread, type FixtureScore } from "./metrics";

/**
 * Evals run at temperature 0; the app runs analysis at 0.2.
 *
 * They are different jobs. The app is writing for a person, and a little
 * variation reads as natural rather than canned. An eval exists to answer
 * "did this prompt change anything?", and it can only answer that if the
 * measurement is repeatable — otherwise prompt effects and sampling noise
 * arrive in the same number and cannot be told apart.
 *
 * This is not free: 0 measures a corner of the distribution rather than the
 * middle of the one users actually get. That is why --runs still exists and
 * still reports spread. A noise floor measured at temperature 0 is the floor
 * below which no band can be honest; the app's real-world spread is wider.
 */
const EVAL_TEMPERATURE = 0;

/**
 * Gemini's free tier caps requests per *model* per day — measured at 20 for
 * gemini-3.5-flash — so a sweep that fires every fixture at one model exhausts
 * it partway through and leaves a half-finished table. Sibling models draw on
 * separate buckets, so the runner rotates through them and records which model
 * produced which row: without that, a "before/after prompt version" comparison
 * is silently comparing two models (NOTES.md, M9 eval planning).
 */
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
const GROQ_MODELS = ["openai/gpt-oss-120b"];

type ProviderName = "groq" | "gemini";

type Args = {
  provider: ProviderName;
  dryRun: boolean;
  only: string | null;
  report: string | null;
  runs: number;
};

function parseArgs(argv: string[]): Args {
  const provider = (value(argv, "--provider") ?? env.LLM_PROVIDER) as string;
  if (provider !== "groq" && provider !== "gemini") {
    throw new Error(`--provider must be groq or gemini (got "${provider}")`);
  }
  const runsRaw = value(argv, "--runs");
  const runs = runsRaw === null ? 3 : Number(runsRaw);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`--runs must be a positive integer (got "${runsRaw}")`);
  }
  return {
    provider,
    dryRun: argv.includes("--dry-run"),
    only: value(argv, "--only"),
    report: value(argv, "--report"),
    runs,
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

/**
 * Why a row has no result. A 503 from an overloaded model says nothing about
 * whether the prompt produces valid output, and folding it into "schema-valid"
 * would report a 60% schema rate for a provider that in fact returned valid
 * JSON every single time it answered.
 */
type Failure = "transport" | "schema" | null;

/** One execution of one fixture. `--runs N` produces N of these. */
type Sample = {
  run: number;
  model: string;
  ok: boolean;
  error: string | null;
  failure: Failure;
  matchScore: number | null;
  droppedClaims: number | null;
  repairs: number | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  score: FixtureScore | null;
  /**
   * The grounded analysis itself. Without it the results file records that a
   * score was in range but not why, and "is the model wrong or is the band
   * wrong?" cannot be answered from the artifact.
   */
  result: AnalysisResult | null;
  /** The generated document, for the cover-letter fixtures. */
  output: string | null;
};

type Row = {
  id: string;
  kind: EvalFixture["kind"];
  expectedScoreRange: readonly [number, number] | null;
  samples: Sample[];
  /** Median rather than mean: with three runs one outlier should not carry it. */
  medianScore: number | null;
  /** max - min across runs. The per-fixture noise floor. */
  spread: number | null;
};

async function runAnalysisOnce(
  fixture: AnalysisFixture,
  provider: LlmProvider,
  cvText: string,
  skills: string[],
  run: number,
): Promise<Sample> {
  const base: Sample = {
    run,
    model: provider.model,
    ok: false,
    error: null,
    failure: null,
    matchScore: null,
    droppedClaims: null,
    repairs: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    score: null,
    result: null,
    output: null,
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
        temperature: EVAL_TEMPERATURE,
        maxTokens: 4096,
      },
      analysisResultSchema,
    );

    const { result, droppedClaims } = groundAnalysis(out.data as AnalysisResult, cvText);

    return {
      ...base,
      ok: true,
      matchScore: result.matchScore,
      droppedClaims,
      repairs: out.attempts - 1,
      latencyMs: out.latencyMs,
      inputTokens: out.usage.inputTokens,
      outputTokens: out.usage.outputTokens,
      score: scoreFixture(fixture, result),
      result,
    };
  } catch (error) {
    if (error instanceof LlmQuotaError) throw error;
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
      failure: classify(error),
    };
  }
}

/**
 * A 503 from an overloaded model says nothing about whether the prompt yields
 * valid output. AnalysisError is thrown only after the single repair has also
 * failed the schema; everything else never got as far as producing an answer.
 */
function classify(error: unknown): Failure {
  return error instanceof AnalysisError ? "schema" : "transport";
}

async function runCoverLetterOnce(
  fixture: CoverLetterFixture,
  provider: LlmProvider,
  cvText: string,
  run: number,
): Promise<Sample> {
  const base: Sample = {
    run,
    model: provider.model,
    ok: false,
    error: null,
    failure: null,
    matchScore: null,
    droppedClaims: null,
    repairs: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    score: null,
    result: null,
    output: null,
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
        temperature: EVAL_TEMPERATURE,
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
      repairs: 0,
      latencyMs: Date.now() - startedAt,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      output: text.trim(),
    };
  } catch (error) {
    if (error instanceof LlmQuotaError) throw error;
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
      failure: classify(error),
    };
  }
}

/** A sample that never ran because the model's daily allowance was gone. */
function quotaSkipped(run: number, model: string): Sample {
  return {
    run,
    model,
    ok: false,
    error: "daily quota exhausted for this model",
    failure: "transport",
    matchScore: null,
    droppedClaims: null,
    repairs: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    score: null,
    result: null,
    output: null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Re-render a run that already happened, spending nothing. Re-running is a
  // fresh sample and answers a different question, so "let me look at that
  // again" has to mean the saved file.
  if (args.report) {
    const saved = JSON.parse(await readFile(args.report, "utf8")) as {
      promptVersion: string;
      provider: string;
      ranAt: string;
      runs?: number;
      rows: Row[];
    };
    console.log(
      `${saved.promptVersion} · ${saved.provider} · ${saved.runs ?? 1} run(s) · ${saved.ranAt}`,
    );
    report(saved.rows);
    return;
  }

  const all = await loadFixtures();
  const fixtures = args.only ? all.filter((f) => f.id === args.only) : all;
  if (!fixtures.length) {
    throw new Error(args.only ? `No fixture with id "${args.only}"` : "No fixtures");
  }

  const models = modelsFor(args.provider);
  const analyses = fixtures.filter((f) => f.kind === "analysis").length;
  const calls = fixtures.length * args.runs;

  // Said up front, before anything is spent (SPEC.md §6.1 / M8).
  console.log(`Prompt version : ${analyzePrompt.version}`);
  console.log(`Provider       : ${args.provider}`);
  console.log(`Models         : ${models.join(", ")}`);
  console.log(`Temperature    : ${EVAL_TEMPERATURE} (the app uses 0.2 — see EVAL_TEMPERATURE)`);
  console.log(
    `Fixtures       : ${fixtures.length} (${analyses} analysis, ${fixtures.length - analyses} cover letter) × ${args.runs} run(s)`,
  );
  console.log(
    `Cost           : ${calls} ${calls === 1 ? "request" : "requests"} minimum, up to ${calls * 2} if every one needs its single repair`,
  );
  if (args.provider === "gemini") {
    console.log(
      `                 spread over ${models.length} sibling models, ~${Math.ceil(calls / models.length)} each against a measured 20/day per model`,
    );
  } else {
    console.log(
      `                 against a measured 1,000/day; roughly ${((calls / 1000) * 100).toFixed(1)}% of the daily budget`,
    );
  }

  if (args.dryRun) {
    console.log("\n--dry-run: fixtures validated, nothing called.");
    return;
  }

  const candidate = needsSharedCandidate(fixtures) ? await loadCandidate() : null;
  console.log(`CV             : ${candidate?.label ?? "per-fixture only"}\n`);

  const rows: Row[] = [];

  // Rotation advances per FIXTURE, so every run of one fixture uses the same
  // model. This is what makes --runs measure anything: with three runs and
  // three siblings, rotating per call gave each fixture three *different*
  // models, and the resulting "spread" was model-to-model difference wearing
  // the label of sampling noise. A noise floor has to hold the model fixed.
  let fixtureIndex = 0;

  // A model whose daily quota is spent stays spent. Dropping it from the
  // rotation is the whole reason the rotation exists.
  const exhausted = new Set<string>();

  for (const fixture of fixtures) {
    const { cvText, skills } = candidateFor(fixture, candidate);
    const samples: Sample[] = [];
    const startedOn = models.filter((m) => !exhausted.has(m))[
      fixtureIndex++ % Math.max(1, models.filter((m) => !exhausted.has(m)).length)
    ];

    for (let run = 1; run <= args.runs; run++) {
      const available = models.filter((m) => !exhausted.has(m));
      if (!available.length) {
        console.log(`  ${fixture.id} [${run}/${args.runs}] … skipped, every model is out of quota`);
        samples.push(quotaSkipped(run, models[0]));
        continue;
      }
      // Stay on this fixture's model unless it ran out mid-way, in which case
      // finishing on another beats not finishing — the sample records which.
      const model = available.includes(startedOn) ? startedOn : available[0];
      const provider = makeProvider(args.provider, model);

      process.stdout.write(`  ${fixture.id} [${run}/${args.runs}] (${model}) … `);
      let sample: Sample;
      try {
        sample =
          fixture.kind === "analysis"
            ? await runAnalysisOnce(fixture, provider, cvText, skills, run)
            : await runCoverLetterOnce(fixture, provider, cvText, run);
      } catch (error) {
        // Previously this propagated and killed the sweep, discarding every
        // sample already collected. One exhausted sibling is not a reason to
        // throw away twelve good measurements.
        if (!(error instanceof LlmQuotaError)) throw error;
        exhausted.add(model);
        sample = quotaSkipped(run, model);
        console.log(`QUOTA SPENT — dropping ${model} from the rotation`);
        samples.push(sample);
        continue;
      }
      samples.push(sample);
      console.log(sample.ok ? `ok  score=${sample.matchScore ?? "—"}` : `FAILED  ${sample.error}`);
    }

    const scores = samples.map((s) => s.matchScore).filter((s): s is number => s !== null);
    rows.push({
      id: fixture.id,
      kind: fixture.kind,
      expectedScoreRange: fixture.kind === "analysis" ? fixture.expectedScoreRange : null,
      samples,
      medianScore: scores.length ? median(scores) : null,
      spread: scores.length ? spread(scores) : null,
    });
  }

  report(rows);
  await write(rows, args.provider, args.runs);
}

/** Every sample across every row, for the aggregate counts. */
function allSamples(rows: Row[]): Sample[] {
  return rows.flatMap((r) => r.samples);
}

function report(rows: Row[]) {
  const analysisRows = rows.filter((r) => r.kind === "analysis");
  const analysis = allSamples(analysisRows);
  const scored = analysis.filter((s) => s.score);
  const valid = analysis.filter((s) => s.ok);
  const letters = allSamples(rows.filter((r) => r.kind === "cover_letter"));

  console.log("\n" + "=".repeat(72));

  if (!analysis.length) {
    console.log("no analysis fixtures loaded — nothing to score");
  } else {
    const transport = analysis.filter((s) => s.failure === "transport");
    const answered = analysis.filter((s) => s.ok || s.failure === "schema");
    if (transport.length) {
      console.log(
        `completed             ${answered.length}/${analysis.length} samples  (${transport.length} never answered)`,
      );
    }
    console.log(
      `schema-valid          ${valid.length}/${answered.length}  (${pct(answered.length ? valid.length / answered.length : 1)} of answers received)`,
    );

    // Judged on the median, not on every sample: with N runs, one outlier
    // should not decide whether a fixture "passed".
    const withMedian = analysisRows.filter((r) => r.medianScore !== null && r.expectedScoreRange);
    const inRange = withMedian.filter((r) => {
      const [lo, hi] = r.expectedScoreRange!;
      return r.medianScore! >= lo && r.medianScore! <= hi;
    });
    console.log(`median in band        ${inRange.length}/${withMedian.length}`);
    console.log(
      `mean score deviation  ${mean(scored.map((s) => s.score!.scoreDeviation)).toFixed(1)} points outside the band`,
    );

    const spreads = analysisRows.map((r) => r.spread).filter((v): v is number => v !== null);
    if (spreads.length && Math.max(...spreads) > 0) {
      console.log(
        `NOISE FLOOR           spread max ${Math.max(...spreads)}, median ${median(spreads)}, mean ${mean(spreads).toFixed(1)} points across runs`,
      );
      console.log(
        `                      no band narrower than ~${Math.max(...spreads) * 2} points can be honest`,
      );
    } else if (spreads.length) {
      console.log(`NOISE FLOOR           0 — every fixture returned an identical score each run`);
    }

    console.log(
      `mustFindSkills recall ${pct(mean(scored.map((s) => s.score!.skillRecall)))}`,
    );
    const gapScored = scored.filter((s) => s.score!.gapRecall !== null);
    if (gapScored.length) {
      console.log(`mustFlagGaps recall   ${pct(mean(gapScored.map((s) => s.score!.gapRecall!)))}`);
    }
    console.log(
      `droppedClaims         ${analysis.reduce((t, s) => t + (s.droppedClaims ?? 0), 0)} total`,
    );
    console.log(
      `repairs needed        ${analysis.filter((s) => (s.repairs ?? 0) > 0).length}/${analysis.length} samples`,
    );
    console.log(
      `wordy gap entries     ${scored.reduce((t, s) => t + s.score!.wordyGaps.length, 0)}  (analyze@2 should hold this at 0)`,
    );
  }

  const all = allSamples(rows);
  console.log(
    `mean latency          ${(mean(all.filter((s) => s.latencyMs).map((s) => s.latencyMs!)) / 1000).toFixed(1)}s`,
  );
  console.log(
    `mean tokens           ${mean(all.map((s) => (s.inputTokens ?? 0) + (s.outputTokens ?? 0))).toFixed(0)}  (${all.reduce((t, s) => t + (s.inputTokens ?? 0) + (s.outputTokens ?? 0), 0)} total)`,
  );
  // Only letters that actually came back: a fixture killed by a rate limit
  // produced no text, and counting it as "not clean" reports a fabrication
  // problem where there was merely no answer.
  const answeredLetters = letters.filter((s) => s.failure !== "transport");
  if (answeredLetters.length) {
    console.log(
      `fabrication check     ${answeredLetters.filter((s) => s.ok).length}/${answeredLetters.length} clean`,
    );
  } else if (letters.length) {
    console.log(`fabrication check     no letters completed`);
  }

  // Per fixture, because the aggregate hides exactly the thing worth seeing.
  const analysisWithScores = analysisRows.filter((r) => r.medianScore !== null);
  if (analysisWithScores.length) {
    console.log("\nper fixture (median, spread, position in band):");
    for (const row of analysisWithScores) {
      const [lo, hi] = row.expectedScoreRange ?? [0, 100];
      const width = hi - lo;
      const pos = width ? ((row.medianScore! - lo) / width) * 100 : 0;
      const inBand = row.medianScore! >= lo && row.medianScore! <= hi;
      const scores = row.samples.map((s) => s.matchScore ?? "—").join(",");
      console.log(
        `  ${row.id.padEnd(34)} ${String(row.medianScore).padStart(3)} ±${String(row.spread).padStart(2)}  [${lo},${hi}] ${inBand ? `${pos.toFixed(0)}%`.padStart(4) : " OUT"}  runs=${scores}`,
      );
    }
  }

  const missed = analysisRows.flatMap((r) =>
    (r.samples[0]?.score?.missedSkills ?? []).map((s) => `${r.id}: ${s}`),
  );
  if (missed.length) console.log(`\nmissed mustFindSkills (first run):\n  ${missed.join("\n  ")}`);

  const failed = allSamples(rows).filter((s) => !s.ok);
  if (failed.length) {
    const byFixture = rows
      .filter((r) => r.samples.some((s) => !s.ok))
      .map((r) => `${r.id}: ${r.samples.filter((s) => !s.ok).length}/${r.samples.length} failed`);
    console.log(`\nfailures:\n  ${byFixture.join("\n  ")}`);
  }
  console.log("=".repeat(72));
}

/**
 * Every run is archived under its own timestamp; the stable filename is only
 * replaced by a run that actually completed.
 *
 * This is not tidiness. A three-run sweep hit Groq's daily token ceiling
 * partway through, failed 22 of 30 samples, and overwrote a complete run whose
 * numbers were already in the README — destroying the baseline it was meant to
 * be compared against. A partial run is still worth keeping; it is not worth
 * promoting over a good one.
 */
async function write(rows: Row[], provider: ProviderName, runs: number) {
  await mkdir(RESULTS_DIR, { recursive: true });

  const body =
    JSON.stringify(
      {
        promptVersion: analyzePrompt.version,
        provider,
        temperature: EVAL_TEMPERATURE,
        runs,
        ranAt: new Date().toISOString(),
        rows,
      },
      null,
      2,
    ) + "\n";

  const base = `${analyzePrompt.version.replace("@", "-")}-${provider}`;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const archive = join(RESULTS_DIR, `${base}-${stamp}.json`);
  await writeFile(archive, body);
  console.log(`\nwritten: ${archive.replace(process.cwd() + "/", "")}`);

  const incomplete = allSamples(rows).filter((s) => s.failure === "transport").length;
  const canonical = join(RESULTS_DIR, `${base}.json`);
  if (incomplete === 0) {
    await writeFile(canonical, body);
    console.log(`updated: ${canonical.replace(process.cwd() + "/", "")}`);
  } else {
    console.log(
      `NOT updating ${base}.json — ${incomplete} sample(s) never answered, so this run must not replace a complete one.`,
    );
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof AnalysisError ? error.message : error}`);
  process.exitCode = 1;
});
