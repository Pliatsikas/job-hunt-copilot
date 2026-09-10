import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  candidateSchema,
  evalFixtureSchema,
  type Candidate,
  type EvalFixture,
} from "../lib/schemas/eval";

export const FIXTURES_DIR = join(process.cwd(), "evals", "fixtures");
export const RESULTS_DIR = join(process.cwd(), "evals", "results");

/** Underscore-prefixed files are configuration, not cases. */
const CANDIDATE_FILE = "_candidate.json";

export class FixtureError extends Error {
  constructor(public readonly file: string, message: string) {
    super(`${file}: ${message}`);
    this.name = "FixtureError";
  }
}

function describeZodIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .map((issue) => `\n    - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("");
}

export async function loadCandidate(dir = FIXTURES_DIR): Promise<Candidate> {
  const path = join(dir, CANDIDATE_FILE);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new FixtureError(
      CANDIDATE_FILE,
      "missing. Every analysis fixture is judged against one shared CV; create this file first.",
    );
  }

  const parsed = candidateSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new FixtureError(CANDIDATE_FILE, `invalid:${describeZodIssues(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * Every fixture is validated before any of them runs. A run costs real quota,
 * so a typo in the tenth file must not surface after nine paid calls.
 */
export async function loadFixtures(dir = FIXTURES_DIR): Promise<EvalFixture[]> {
  const entries = await readdir(dir);
  const files = entries.filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();

  const fixtures: EvalFixture[] = [];
  const problems: string[] = [];

  for (const file of files) {
    let json: unknown;
    try {
      json = JSON.parse(await readFile(join(dir, file), "utf8"));
    } catch (error) {
      problems.push(`${file}: not valid JSON — ${(error as Error).message}`);
      continue;
    }

    const parsed = evalFixtureSchema.safeParse(json);
    if (!parsed.success) {
      problems.push(`${file}: ${describeZodIssues(parsed.error)}`);
      continue;
    }
    fixtures.push(parsed.data);
  }

  const seen = new Map<string, string>();
  for (let i = 0; i < fixtures.length; i++) {
    const { id } = fixtures[i];
    const previous = seen.get(id);
    if (previous) problems.push(`${files[i]}: duplicate id "${id}", already used by ${previous}`);
    seen.set(id, files[i]);
  }

  if (problems.length) {
    throw new Error(`Fixture problems, nothing was run:\n${problems.join("\n")}`);
  }
  return fixtures;
}

/**
 * The CV a fixture is judged against: its own override, or the shared one.
 * `shared` may be null — a fixture that carries its own CV (the M5 regression
 * case does) must be runnable without _candidate.json existing at all.
 */
export function candidateFor(
  fixture: EvalFixture,
  shared: Candidate | null,
): { cvText: string; skills: string[] } {
  const cvText = fixture.cvText ?? shared?.cvText;
  const skills = fixture.skills ?? shared?.skills;
  if (cvText === undefined || skills === undefined) {
    throw new FixtureError(
      `${fixture.id}.json`,
      "has no cvText of its own and there is no _candidate.json to fall back to.",
    );
  }
  return { cvText, skills };
}

/** True when at least one fixture depends on the shared CV. */
export function needsSharedCandidate(fixtures: EvalFixture[]): boolean {
  return fixtures.some((f) => f.cvText === undefined || f.skills === undefined);
}
