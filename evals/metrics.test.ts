import { describe, expect, it } from "vitest";
import { VALID_RESULT } from "../lib/llm/fixtures";
import type { AnalysisResult } from "../lib/schemas/analysis";
import type { AnalysisFixture } from "../lib/schemas/eval";
import { isWordyGap, recall, scoreDeviation, scoreFixture, skillMatches } from "./metrics";

describe("scoreDeviation", () => {
  it("is zero anywhere inside the band", () => {
    // The author committed to a range they consider fair; a score inside it is
    // not an error to be averaged away.
    expect(scoreDeviation(40, [40, 60])).toBe(0);
    expect(scoreDeviation(60, [40, 60])).toBe(0);
    expect(scoreDeviation(50, [40, 60])).toBe(0);
  });

  it("measures distance to the nearest bound, in both directions", () => {
    expect(scoreDeviation(31, [40, 60])).toBe(9);
    expect(scoreDeviation(72, [40, 60])).toBe(12);
  });
});

describe("skillMatches", () => {
  it("accepts a more specific answer than the fixture asked for", () => {
    // Calling "React 18" a miss for "react" measures vocabulary, not judgement.
    expect(skillMatches("react", "React 18")).toBe(true);
    expect(skillMatches("react", "react.js")).toBe(true);
    expect(skillMatches("typescript", "TypeScript")).toBe(true);
  });

  it("does not match unrelated skills that share no text", () => {
    expect(skillMatches("react", "vue")).toBe(false);
    expect(skillMatches("go", "mongodb")).toBe(false);
  });

  it("ignores an empty side rather than matching everything", () => {
    expect(skillMatches("", "react")).toBe(false);
    expect(skillMatches("react", "   ")).toBe(false);
  });
});

describe("recall", () => {
  it("splits found from missed", () => {
    const out = recall(["react", "kubernetes"], ["React", "Docker"]);
    expect(out.found).toEqual(["react"]);
    expect(out.missed).toEqual(["kubernetes"]);
  });
});

describe("isWordyGap", () => {
  it("flags the v1 failures that analyze@2 exists to prevent", () => {
    expect(isWordyGap("3-5 years of web development experience")).toBe(true);
    expect(isWordyGap("5+ years of industry experience")).toBe(true);
    expect(isWordyGap("moodle or other educational platforms (lms)")).toBe(true);
    // Greek, because the postings are: \b would not have matched here.
    expect(isWordyGap("5+ χρόνια επαγγελματικής εμπειρίας")).toBe(true);
  });

  it("leaves real skill names alone, including multi-word ones", () => {
    expect(isWordyGap("Kubernetes")).toBe(false);
    expect(isWordyGap("ASP.NET Core Web API")).toBe(false);
    expect(isWordyGap("Oracle 19c")).toBe(false);
    expect(isWordyGap("Object-Oriented programming")).toBe(false);
  });
});

describe("scoreFixture", () => {
  const fixture = {
    id: "x",
    kind: "analysis",
    notes: "n",
    roleTitle: "r",
    companyName: null,
    source: null,
    language: "en",
    jobDescription: "x".repeat(200),
    expectedScoreRange: [40, 60],
    mustFindSkills: ["react", "docker"],
    mustFlagGaps: ["kubernetes"],
  } as AnalysisFixture;

  function result(overrides: Partial<AnalysisResult>): AnalysisResult {
    return { ...VALID_RESULT, ...overrides };
  }

  it("scores a clean run", () => {
    const out = scoreFixture(
      fixture,
      result({
        matchScore: 50,
        matchedSkills: [
          { skill: "React", evidenceFromCv: "q" },
          { skill: "Docker", evidenceFromCv: "q" },
        ],
        gaps: [{ skill: "Kubernetes", severity: "blocker", howToBridge: "b" }],
      }),
    );

    expect(out.inRange).toBe(true);
    expect(out.skillRecall).toBe(1);
    expect(out.gapRecall).toBe(1);
    expect(out.wordyGaps).toEqual([]);
  });

  it("reports partial recall and names what was missed", () => {
    const out = scoreFixture(
      fixture,
      result({
        matchScore: 20,
        matchedSkills: [{ skill: "React", evidenceFromCv: "q" }],
        gaps: [],
      }),
    );

    expect(out.skillRecall).toBe(0.5);
    expect(out.missedSkills).toEqual(["docker"]);
    expect(out.scoreDeviation).toBe(20);
    expect(out.gapRecall).toBe(0);
    expect(out.missedGaps).toEqual(["kubernetes"]);
  });

  it("catches a v1-style gap regression", () => {
    const out = scoreFixture(
      fixture,
      result({
        matchScore: 50,
        gaps: [{ skill: "3-5 years of web development experience", severity: "blocker", howToBridge: "b" }],
      }),
    );

    expect(out.wordyGaps).toEqual(["3-5 years of web development experience"]);
  });

  it("leaves gapRecall null when the fixture makes no claim about gaps", () => {
    const out = scoreFixture({ ...fixture, mustFlagGaps: [] }, result({ matchScore: 50 }));
    expect(out.gapRecall).toBeNull();
  });
});

describe("skillMatches token boundaries", () => {
  it("does not score a hit for a short skill buried inside another word", () => {
    // The bug this replaced: `includes` made "mongodb" a match for "go", so a
    // fixture asking for Go scored a hit on an answer that never mentioned it.
    expect(skillMatches("go", "mongodb")).toBe(false);
    expect(skillMatches("go", "django")).toBe(false);
    expect(skillMatches("r", "react")).toBe(false);
    expect(skillMatches("c", "c#")).toBe(false);
  });

  it("still matches at a non-letter boundary", () => {
    expect(skillMatches("react", "react.js")).toBe(true);
    expect(skillMatches("node", "node.js")).toBe(true);
    expect(skillMatches("c#", "c# and .net")).toBe(true);
    expect(skillMatches("go", "go 1.22")).toBe(true);
  });

  it("works on Greek, where \\b would silently never match", () => {
    expect(skillMatches("ασφάλεια", "ασφάλεια δεδομένων")).toBe(true);
    expect(skillMatches("ασφ", "ασφάλεια")).toBe(false);
  });

  it("does not blow up on regex metacharacters in a skill name", () => {
    expect(skillMatches("c++", "c++ and rust")).toBe(true);
    expect(skillMatches("a.b", "axb")).toBe(false);
  });
});
