import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { candidateFor, loadCandidate, loadFixtures, needsSharedCandidate } from "./load";

const CANDIDATE = {
  label: "test",
  cvText: "I build React frontends with TypeScript.",
  skills: ["React", " TypeScript "],
};

function analysisFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "example-role",
    kind: "analysis",
    notes: "A baseline case.",
    roleTitle: "Frontend Developer",
    language: "en",
    jobDescription: "x".repeat(200),
    expectedScoreRange: [40, 60],
    mustFindSkills: ["react"],
    ...overrides,
  };
}

async function fixtureDir(files: Record<string, unknown>) {
  const dir = await mkdtemp(join(tmpdir(), "evals-"));
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, name), JSON.stringify(body));
  }
  return dir;
}

describe("loadCandidate", () => {
  it("normalises skills to trimmed lowercase", async () => {
    const dir = await fixtureDir({ "_candidate.json": CANDIDATE });
    const candidate = await loadCandidate(dir);
    expect(candidate.skills).toEqual(["react", "typescript"]);
  });

  it("says what to do when the shared CV is missing", async () => {
    const dir = await fixtureDir({});
    await expect(loadCandidate(dir)).rejects.toThrow(/missing[\s\S]*shared CV/);
  });
});

describe("loadFixtures", () => {
  it("ignores underscore-prefixed configuration files", async () => {
    const dir = await fixtureDir({
      "_candidate.json": CANDIDATE,
      "a.json": analysisFixture(),
    });
    const fixtures = await loadFixtures(dir);
    expect(fixtures.map((f) => f.id)).toEqual(["example-role"]);
  });

  it("validates every fixture before running any of them", async () => {
    // A run costs real quota; a typo in the last file must not surface after
    // nine paid calls. Both problems are reported at once, too.
    const dir = await fixtureDir({
      "a.json": analysisFixture(),
      "b.json": analysisFixture({ id: "Bad_Id", mustFindSkills: [] }),
      "c.json": analysisFixture({ id: "c", expectedScoreRange: [80, 20] }),
    });

    const error = await loadFixtures(dir).then(() => null, (e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    if (!error) throw new Error("expected a failure");
    expect(error.message).toContain("nothing was run");
    expect(error.message).toContain("kebab-case");
    expect(error.message).toContain("min <= max");
  });

  it("rejects a duplicate id rather than silently overwriting a result", async () => {
    const dir = await fixtureDir({
      "a.json": analysisFixture(),
      "b.json": analysisFixture(),
    });
    await expect(loadFixtures(dir)).rejects.toThrow(/duplicate id "example-role"/);
  });

  it("names the file when the JSON itself is malformed", async () => {
    const dir = await fixtureDir({ "a.json": analysisFixture() });
    await writeFile(join(dir, "broken.json"), "{ nope");
    await expect(loadFixtures(dir)).rejects.toThrow(/broken\.json: not valid JSON/);
  });

  it("refuses a summarised job description", async () => {
    const dir = await fixtureDir({ "a.json": analysisFixture({ jobDescription: "Short ad." }) });
    await expect(loadFixtures(dir)).rejects.toThrow(/Paste the whole ad/);
  });

  it("loads the real repo fixtures", async () => {
    // Guards the M5 regression case against drifting out of the schema.
    const fixtures = await loadFixtures();
    expect(fixtures.some((f) => f.id === "no-fabricated-bridge")).toBe(true);
  });
});

describe("candidateFor", () => {
  it("uses the shared CV by default", async () => {
    const dir = await fixtureDir({ "_candidate.json": CANDIDATE, "a.json": analysisFixture() });
    const [fixture] = await loadFixtures(dir);
    const shared = await loadCandidate(dir);
    expect(candidateFor(fixture, shared).cvText).toBe(CANDIDATE.cvText);
  });

  it("lets a fixture override it, which is how the M5 case carries its own", async () => {
    const dir = await fixtureDir({
      "_candidate.json": CANDIDATE,
      "a.json": analysisFixture({ cvText: "A different CV entirely.", skills: ["Go"] }),
    });
    const [fixture] = await loadFixtures(dir);
    const shared = await loadCandidate(dir);
    expect(candidateFor(fixture, shared)).toEqual({
      cvText: "A different CV entirely.",
      skills: ["go"],
    });
  });
});

describe("needsSharedCandidate", () => {
  it("is false when every fixture brings its own CV", async () => {
    const dir = await fixtureDir({
      "a.json": analysisFixture({ cvText: "own cv", skills: ["go"] }),
    });
    const fixtures = await loadFixtures(dir);
    expect(needsSharedCandidate(fixtures)).toBe(false);
    // ...and it can then run without _candidate.json existing at all.
    expect(candidateFor(fixtures[0], null).cvText).toBe("own cv");
  });

  it("is true as soon as one fixture relies on the shared CV", async () => {
    const dir = await fixtureDir({
      "a.json": analysisFixture({ cvText: "own cv", skills: ["go"] }),
      "b.json": analysisFixture({ id: "b" }),
    });
    expect(needsSharedCandidate(await loadFixtures(dir))).toBe(true);
  });

  it("names the fixture when there is no CV for it anywhere", async () => {
    const dir = await fixtureDir({ "a.json": analysisFixture() });
    const [fixture] = await loadFixtures(dir);
    expect(() => candidateFor(fixture, null)).toThrow(/example-role\.json[\s\S]*no cvText/);
  });
});
