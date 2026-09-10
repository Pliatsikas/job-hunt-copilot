import { describe, expect, it } from "vitest";
import { VALID_RESULT } from "../fixtures";
import * as analyzeV1 from "./analyze.v1";
import * as analyzeV2 from "./analyze.v2";
import * as coverLetter from "./cover-letter.v1";
import * as followUp from "./follow-up.v1";
import { topGap } from "./shared";
import type { AnalysisResult } from "../../schemas/analysis";

const base = {
  cvText: "I built REST APIs and deployed with Docker.",
  jobDescription: "Backend engineer. Kubernetes required.",
  roleTitle: "Backend Engineer",
  companyName: "Acme",
};

describe("versioning", () => {
  it("each prompt exports a version, which is what gets stored", () => {
    expect(analyzeV1.version).toBe("analyze@1");
    expect(analyzeV2.version).toBe("analyze@2");
    expect(coverLetter.version).toBe("cover-letter@1");
    expect(followUp.version).toBe("follow-up@1");
  });

  it("keeps v1 around so old Analysis rows stay explicable", () => {
    // Every stored row records the version that produced it. Deleting a
    // prompt would leave those rows referring to something that no longer
    // exists, and the v1/v2 comparison is the artifact M9 is here to produce.
    expect(analyzeV1.system).not.toBe(analyzeV2.system);
    expect(typeof analyzeV1.buildUserPrompt).toBe("function");
  });
});

describe("analyze@2 gap rules", () => {
  const prompt = analyzeV2.system;

  it("says a gap is one skill, not a sentence or a list", () => {
    expect(prompt).toMatch(/ONE skill/);
    expect(prompt).toMatch(/four separate\s+gap entries/);
  });

  it("routes years-of-experience demands to redFlags", () => {
    // The v1 failure: "3-5 years of web development experience" arrived as a
    // gap skill, so it could never repeat across postings and never counted.
    expect(prompt).toMatch(/redFlags, never gaps/);
    expect(prompt).toMatch(/years of experience/i);
  });

  it("keeps the grounding rule v1 established", () => {
    expect(prompt).toMatch(/verbatim quote/);
    expect(analyzeV2.buildUserPrompt({ cvText: "cv", skills: [], jobDescription: "jd" })).toContain(
      "verbatim quote",
    );
  });

  it("names the skills the candidate declared, or says none", () => {
    const withSkills = analyzeV2.buildUserPrompt({
      cvText: "cv",
      skills: ["react", "docker"],
      jobDescription: "jd",
    });
    expect(withSkills).toContain("react, docker");
    expect(
      analyzeV2.buildUserPrompt({ cvText: "cv", skills: [], jobDescription: "jd" }),
    ).toContain("(none listed)");
  });
});

describe("topGap", () => {
  it("prefers a blocker over an important gap regardless of order", () => {
    const analysis: AnalysisResult = {
      ...VALID_RESULT,
      gaps: [
        { skill: "graphql", severity: "important", howToBridge: "read docs" },
        { skill: "kubernetes", severity: "blocker", howToBridge: "deploy to k3s" },
        { skill: "gulp", severity: "nice_to_have", howToBridge: "skim it" },
      ],
    };
    expect(topGap(analysis)?.skill).toBe("kubernetes");
  });

  it("returns null when there are no gaps", () => {
    expect(topGap({ ...VALID_RESULT, gaps: [] })).toBeNull();
  });
});

describe("cover letter prompt", () => {
  const input = {
    ...base,
    analysis: VALID_RESULT,
    language: "en" as const,
    tone: "direct" as const,
    length: "standard" as const,
  };

  it("forbids inventing experience", () => {
    expect(coverLetter.system).toMatch(/Never claim experience the CV does not show/i);
  });

  it("requires the top gap to be addressed rather than hidden", () => {
    expect(coverLetter.system).toMatch(/Address the biggest gap honestly/i);
    const prompt = coverLetter.buildUserPrompt(input);
    expect(prompt).toContain("kubernetes");
    expect(prompt).toMatch(/Do not pretend it isn't there/i);
  });

  it("passes the verified evidence quotes through to the model", () => {
    const prompt = coverLetter.buildUserPrompt(input);
    for (const match of VALID_RESULT.matchedSkills) {
      expect(prompt).toContain(match.evidenceFromCv);
    }
  });

  it("tells the model to stay conservative when there is no analysis", () => {
    const prompt = coverLetter.buildUserPrompt({ ...input, analysis: null });
    expect(prompt).toMatch(/no verified matches/i);
    expect(prompt).toMatch(/stay conservative/i);
  });

  it("does not invent a gap when the analysis found none", () => {
    const prompt = coverLetter.buildUserPrompt({
      ...input,
      analysis: { ...VALID_RESULT, gaps: [] },
    });
    expect(prompt).toMatch(/Do not invent one to look humble/i);
  });

  it("bans placeholder text", () => {
    expect(coverLetter.system).toMatch(/\[Your Name\]/);
  });

  it("varies with tone and length", () => {
    const short = coverLetter.buildUserPrompt({ ...input, length: "short" });
    const standard = coverLetter.buildUserPrompt({ ...input, length: "standard" });
    expect(short).not.toBe(standard);
    expect(short).toMatch(/At most 150 words/);

    const formal = coverLetter.buildUserPrompt({ ...input, tone: "formal" });
    expect(formal).toMatch(/no contractions/i);
  });
});

describe("Greek output", () => {
  it("demands idiomatic Greek rather than translated English", () => {
    const greek = coverLetter.buildUserPrompt({
      ...base,
      analysis: VALID_RESULT,
      language: "el",
      tone: "warm",
      length: "short",
    });

    expect(greek).toMatch(/Γράψε στα ελληνικά/);
    expect(greek).toMatch(/not English composed with Greek\s*\n?words/i);
    // The specific failure mode worth naming: calqued business idiom.
    expect(greek).toMatch(/I am reaching out/);
    // Technical terms should survive untranslated.
    expect(greek).toMatch(/React, backend, deployment/);
  });

  it("English does not carry the Greek guidance", () => {
    const english = coverLetter.buildUserPrompt({
      ...base,
      analysis: VALID_RESULT,
      language: "en",
      tone: "direct",
      length: "short",
    });
    expect(english).not.toMatch(/Γράψε στα ελληνικά/);
  });
});

describe("follow-up prompt", () => {
  const input = {
    ...base,
    context: "after_applying" as const,
    language: "en" as const,
    tone: "warm" as const,
  };

  it("covers exactly the three specified contexts", () => {
    expect(followUp.FOLLOW_UP_CONTEXTS).toEqual([
      "after_applying",
      "after_interview",
      "nudge",
    ]);
  });

  it("produces different guidance per context", () => {
    const prompts = followUp.FOLLOW_UP_CONTEXTS.map((context) =>
      followUp.buildUserPrompt({ ...input, context }),
    );
    expect(new Set(prompts).size).toBe(3);
  });

  it("refuses to invent interview details", () => {
    const afterInterview = followUp.buildUserPrompt({ ...input, context: "after_interview" });
    expect(afterInterview).toMatch(/Do not invent details of what was discussed/i);
  });

  it("keeps the nudge gracious rather than aggrieved", () => {
    const nudge = followUp.buildUserPrompt({ ...input, context: "nudge" });
    expect(nudge).toMatch(/Do not express frustration/i);
    expect(nudge).toMatch(/easy exit/i);
  });

  it("asks for a subject line and keeps it short", () => {
    expect(followUp.system).toMatch(/Subject:/);
    expect(followUp.system).toMatch(/under 120 words/i);
  });
});

describe("gap framing (regression: fabricated progress)", () => {
  // A real Greek generation turned the analysis's howToBridge advice
  // ("build a small CRUD app in Laravel") into "I am currently building a
  // full CRUD application with Laravel" — a claim absent from the CV.
  it("marks the bridge as advice, not as something already underway", () => {
    const prompt = coverLetter.buildUserPrompt({
      ...base,
      analysis: VALID_RESULT,
      language: "en",
      tone: "direct",
      length: "standard",
    });
    expect(prompt).toMatch(/NOT something the candidate has done/i);
    expect(prompt).toMatch(/do not invent\s+progress against it/i);
  });

  it("spells the failure mode out in the system prompt", () => {
    expect(coverLetter.system).toMatch(/I am currently building X/);
    expect(coverLetter.system).toMatch(/Express intent as intent/i);
  });
});
