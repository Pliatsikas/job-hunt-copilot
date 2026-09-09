import { describe, expect, it, vi } from "vitest";

// insights.ts reaches for the session and the client at module load; neither is
// involved in assembling the sentence, which is the whole point of computing it
// in TypeScript rather than asking a model.
vi.mock("../auth", () => ({ requireUser: vi.fn() }));
vi.mock("../db", () => ({ db: { $queryRaw: vi.fn() } }));

import { buildHeadline, MIN_ANALYSES_FOR_INSIGHTS, type Insights } from "./insights";

type HeadlineInput = Pick<
  Insights,
  "totalAnalyses" | "analysedApplications" | "missingSkills" | "scoreTrend" | "sources"
>;

function input(overrides: Partial<HeadlineInput> = {}): HeadlineInput {
  return {
    totalAnalyses: 8,
    analysedApplications: 8,
    missingSkills: [],
    scoreTrend: [],
    sources: [],
    ...overrides,
  };
}

describe("buildHeadline", () => {
  it("says nothing before the cold-start threshold is cleared", () => {
    const headline = buildHeadline(
      input({
        totalAnalyses: MIN_ANALYSES_FOR_INSIGHTS - 1,
        missingSkills: [{ skill: "kubernetes", severity: "blocker", count: 3 }],
      }),
    );

    expect(headline).toBeNull();
  });

  it("prefers a blocker over a more frequent nice-to-have", () => {
    const headline = buildHeadline(
      input({
        missingSkills: [
          { skill: "jquery", severity: "nice_to_have", count: 7 },
          { skill: "kubernetes", severity: "blocker", count: 2 },
        ],
      }),
    );

    // Seven mentions of jQuery cost nothing; two roles that will not hire you
    // without Kubernetes are the finding.
    expect(headline).toContain("blocking gap is kubernetes");
    expect(headline).not.toContain("jquery");
  });

  it("falls back to the most common gap when nothing is a blocker", () => {
    const headline = buildHeadline(
      input({
        missingSkills: [
          { skill: "graphql", severity: "important", count: 4 },
          { skill: "jquery", severity: "nice_to_have", count: 1 },
        ],
      }),
    );

    expect(headline).toContain("most common gap is graphql, missing from 4 of 8 analysed roles");
  });

  it("counts the denominator in applications, not analyses", () => {
    // Six analyses over five applications: the gap counts come from the
    // deduped per-application query, so "of 6" would be comparing two
    // different populations.
    const headline = buildHeadline(
      input({
        totalAnalyses: 6,
        analysedApplications: 5,
        missingSkills: [{ skill: "kubernetes", severity: "blocker", count: 3 }],
      }),
    );

    expect(headline).toContain("missing from 3 of 5 analysed roles");
  });

  it("reports a rise across months", () => {
    const headline = buildHeadline(
      input({
        scoreTrend: [
          { month: "2026-06", averageScore: 41, analyses: 3 },
          { month: "2026-09", averageScore: 58, analyses: 5 },
        ],
      }),
    );

    expect(headline).toContain("risen 17 points since 2026-06");
  });

  it("reports a fall without inverting the sign", () => {
    const headline = buildHeadline(
      input({
        scoreTrend: [
          { month: "2026-06", averageScore: 60, analyses: 3 },
          { month: "2026-09", averageScore: 44, analyses: 5 },
        ],
      }),
    );

    expect(headline).toContain("fallen 16 points since 2026-06");
  });

  it("calls a small movement steady rather than a trend", () => {
    const headline = buildHeadline(
      input({
        scoreTrend: [
          { month: "2026-08", averageScore: 52, analyses: 4 },
          { month: "2026-09", averageScore: 55, analyses: 4 },
        ],
      }),
    );

    expect(headline).toContain("held steady around 55");
    expect(headline).not.toContain("risen");
  });

  it("needs two months before it will describe a direction", () => {
    const headline = buildHeadline(
      input({
        missingSkills: [{ skill: "go", severity: "blocker", count: 2 }],
        scoreTrend: [{ month: "2026-09", averageScore: 55, analyses: 8 }],
      }),
    );

    expect(headline).toContain("blocking gap is go");
    expect(headline).not.toContain("steady");
    expect(headline).not.toContain("since");
  });

  it("names a best source only when there is something to compare it against", () => {
    const one = buildHeadline(
      input({ sources: [{ source: "LinkedIn", averageScore: 62, applications: 4 }] }),
    );
    expect(one).toBeNull();

    const two = buildHeadline(
      input({
        sources: [
          { source: "LinkedIn", averageScore: 62, applications: 4 },
          { source: "kariera.gr", averageScore: 38, applications: 3 },
        ],
      }),
    );
    expect(two).toContain("LinkedIn is producing your strongest matches (62 average)");
    expect(two).not.toContain("kariera.gr");
  });

  it("returns null rather than a bare full stop when every aggregate is empty", () => {
    expect(buildHeadline(input())).toBeNull();
  });

  it("joins the three clauses into one sentence", () => {
    const headline = buildHeadline(
      input({
        totalAnalyses: 11,
        analysedApplications: 9,
        missingSkills: [{ skill: "kubernetes", severity: "blocker", count: 5 }],
        scoreTrend: [
          { month: "2026-07", averageScore: 40, analyses: 4 },
          { month: "2026-09", averageScore: 55, analyses: 5 },
        ],
        sources: [
          { source: "referral", averageScore: 71, applications: 2 },
          { source: "LinkedIn", averageScore: 44, applications: 7 },
        ],
      }),
    );

    expect(headline).toBe(
      "Your blocking gap is kubernetes, missing from 5 of 9 analysed roles, " +
        "your average match has risen 15 points since 2026-07, " +
        "and referral is producing your strongest matches (71 average).",
    );
  });
});
