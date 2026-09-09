import { describe, expect, it } from "vitest";
import { groundAnalysis, groundMatchedSkills, MIN_EVIDENCE_CHARS } from "./grounding";
import { FIXTURE_CV, VALID_RESULT } from "./fixtures";

describe("groundMatchedSkills", () => {
  it("keeps evidence that really is in the CV", () => {
    const out = groundMatchedSkills(VALID_RESULT.matchedSkills, FIXTURE_CV);
    expect(out.matchedSkills).toHaveLength(2);
    expect(out.droppedClaims).toBe(0);
    expect(out.lowConfidence).toBe(false);
  });

  it("drops a skill the model invented, and counts it", () => {
    const out = groundMatchedSkills(
      [
        ...VALID_RESULT.matchedSkills,
        {
          skill: "kubernetes",
          evidenceFromCv: "I ran production Kubernetes clusters for three years.",
        },
      ],
      FIXTURE_CV,
    );

    expect(out.matchedSkills.map((m) => m.skill)).toEqual(["rest apis", "docker"]);
    expect(out.droppedClaims).toBe(1);
    expect(out.lowConfidence).toBe(false);
  });

  it("rejects evidence shorter than the minimum, even when it appears in the CV", () => {
    // "Docker" is genuinely in the CV, but a bare skill name is not evidence.
    const short = "Docker";
    expect(short.length).toBeLessThan(MIN_EVIDENCE_CHARS);

    const out = groundMatchedSkills([{ skill: "docker", evidenceFromCv: short }], FIXTURE_CV);
    expect(out.matchedSkills).toHaveLength(0);
    expect(out.droppedClaims).toBe(1);
  });

  it("tolerates smart quotes, dashes and whitespace differences", () => {
    const out = groundMatchedSkills(
      [
        {
          skill: "rag",
          // Curly quote, en dash and collapsed spacing versus the CV.
          evidenceFromCv: "  I designed and built a RAG‑based AI copilot   for Jira  ",
        },
      ],
      FIXTURE_CV,
    );
    expect(out.matchedSkills).toHaveLength(1);
    expect(out.droppedClaims).toBe(0);
  });

  it("ignores trailing punctuation the model adds to a quote", () => {
    const out = groundMatchedSkills(
      [{ skill: "socket.io", evidenceFromCv: "real-time collaboration over WebSockets;" }],
      FIXTURE_CV,
    );
    expect(out.matchedSkills).toHaveLength(1);
  });

  it("flags low confidence when every claimed match is ungrounded", () => {
    const out = groundMatchedSkills(
      [
        { skill: "kubernetes", evidenceFromCv: "I ran Kubernetes clusters in production." },
        { skill: "go", evidenceFromCv: "I wrote microservices in Go for four years." },
      ],
      FIXTURE_CV,
    );
    expect(out.matchedSkills).toHaveLength(0);
    expect(out.droppedClaims).toBe(2);
    expect(out.lowConfidence).toBe(true);
  });

  it("does not flag low confidence when the model claimed nothing at all", () => {
    const out = groundMatchedSkills([], FIXTURE_CV);
    expect(out.lowConfidence).toBe(false);
    expect(out.droppedClaims).toBe(0);
  });
});

describe("groundAnalysis", () => {
  it("returns a result whose matchedSkills are all grounded", () => {
    const withFake = {
      ...VALID_RESULT,
      matchedSkills: [
        ...VALID_RESULT.matchedSkills,
        { skill: "go", evidenceFromCv: "Four years of Go microservices in production." },
      ],
    };

    const { result, droppedClaims, lowConfidence } = groundAnalysis(withFake, FIXTURE_CV);
    expect(result.matchedSkills).toHaveLength(2);
    expect(droppedClaims).toBe(1);
    expect(lowConfidence).toBe(false);
    // Everything else passes through untouched.
    expect(result.gaps).toEqual(VALID_RESULT.gaps);
    expect(result.matchScore).toBe(VALID_RESULT.matchScore);
  });
});
