import { describe, expect, it } from "vitest";
import { factTokens, matchesLanguage, supportShare, unsupportedFacts } from "./facts";

const SOURCE = `Web Developer Intern at E-Avenue, Thessaloniki, March 2026 to May 2026.
I designed and built a RAG-based AI copilot for Jira that queries internal knowledge bases.
TaskFlow stack: Next.js 15, React, Node.js, Express, PostgreSQL, Prisma, Socket.io, Docker, TypeScript.
I implemented a REST API with JWT authentication.`;

describe("factTokens", () => {
  it("picks numbers, tech-shaped tokens and mid-sentence proper nouns, not ordinary words", () => {
    expect(factTokens("Built a RAG-based copilot for Jira with Next.js 15 and PostgreSQL in 2026.")).toEqual([
      "RAG-based",
      "Jira",
      "Next.js",
      "15",
      "PostgreSQL",
      "2026",
    ]);
    // Sentence-initial "Designed" is not a fact; "Greek" mid-sentence is.
    expect(factTokens("Designed the schema. Wrote Greek documentation.")).toEqual(["Greek"]);
  });
});

describe("unsupportedFacts", () => {
  it("accepts a rewrite whose facts are all in the source", () => {
    expect(unsupportedFacts("Designed and built a RAG-based AI copilot for Jira, querying internal knowledge bases.", SOURCE)).toEqual([]);
    expect(unsupportedFacts("Implemented REST APIs with JWT authentication on Node.js and PostgreSQL.", SOURCE)).toEqual([]);
  });
  it("catches an invented technology, company or number", () => {
    expect(unsupportedFacts("Built the copilot with LangChain for Atlassian, serving 500 users.", SOURCE)).toEqual(["LangChain", "Atlassian", "500"]);
    expect(unsupportedFacts("Led a team of 4 engineers at E-Avenue.", SOURCE)).toEqual(["4"]);
  });
  it("survives the model's non-breaking hyphens and finds facts after dashes, brackets and commas", () => {
    const src = "Web Developer Intern at E-Avenue. Replaced a legacy MS Access database (~2,600 records). Retrieval-Augmented Generation pipelines.";
    expect(unsupportedFacts("Interned at E‑Avenue; migrated ~2,600 records; built Retrieval‑Augmented Generation pipelines.", src)).toEqual([]);
  });

  it("accepts a compound glued from facts the CV has, refuses one with a part it lacks", () => {
    expect(unsupportedFacts("Node.js/PostgreSQL backends with JWT-secured APIs.", SOURCE)).toEqual([]);
    expect(unsupportedFacts("Node.js/MongoDB backends.", SOURCE)).toEqual(["Node.js/MongoDB"]);
  });

  it("handles Greek the same way", () => {
    const el = "Ανέπτυξα RAG copilot για το Jira στην E-Avenue, Θεσσαλονίκη, Μάρτιος 2026.";
    expect(unsupportedFacts("Ανάπτυξη RAG copilot για το Jira στην E-Avenue.", el)).toEqual([]);
    expect(unsupportedFacts("Ανάπτυξη copilot για το Confluence στη Vodafone.", el)).toEqual(["Confluence", "Vodafone"]);
  });
});

describe("matchesLanguage", () => {
  it("tells Greek from English by script", () => {
    expect(matchesLanguage("Ανέπτυξα REST API με Node.js", "el")).toBe(true);
    expect(matchesLanguage("Built a REST API with Node.js", "el")).toBe(false);
    expect(matchesLanguage("Built a REST API with Node.js", "en")).toBe(true);
  });
});

describe("supportShare", () => {
  const ref = "I designed and built a RAG-based AI copilot for Jira that queries internal knowledge bases and ticket history to speed up issue resolution.";
  it("is high for a rephrasing of the reference", () => {
    expect(supportShare("Designed and built a RAG-based AI copilot for Jira, querying internal knowledge bases and ticket history.", ref)).toBeGreaterThanOrEqual(0.8);
  });
  it("is low for an invention made of ordinary words", () => {
    expect(supportShare("Collaborated with senior developers in an agile environment, improving code quality and delivery speed.", ref)).toBeLessThan(0.3);
  });
});
