import { describe, expect, it } from "vitest";
import { EMPTY_CV } from "../schemas/structured-cv";
import { groundExtraction } from "./extract-grounding";

const SOURCE = `Alexandros Pliatsikas
Applied Informatics · Fullstack & AI Development
Web Developer Intern at E-Avenue, Thessaloniki, March 2026 to May 2026.
I designed and built a RAG-based AI copilot for Jira that queries internal knowledge bases.
I developed an OCR pipeline for passports.
Skills: React, Next.js, TypeScript`;

// Sentences of SOURCE as the prompt numbers them: S4 is the Jira line, S5 the OCR line.
const JIRA = "S4";
const OCR = "S5";

describe("groundExtraction", () => {
  it("keeps rewritten bullets that say what their source sentence says; drops invented facts, invented sentences and padding", () => {
    const { cv, dropped } = groundExtraction(
      {
        ...EMPTY_CV,
        education: [],
        projects: [],
        name: "Alexandros Pliatsikas",
        subtitle: "Applied Informatics · Fullstack & AI Development",
        about: "Fullstack developer with hands-on RAG and OCR work at E-Avenue.",
        skillGroups: [{ id: "", label: "Frontend", skills: [{ id: "", name: "React" }, { id: "", name: "Vue" }] }],
        experience: [
          {
            id: "",
            title: "Web Developer Intern",
            org: "E-Avenue",
            date: "Mar 2026 – May 2026",
            location: "Thessaloniki",
            links: [],
            bullets: [
              { id: "", text: "Designed and built a RAG-based AI copilot for Jira that queries internal knowledge bases.", source: JIRA },
              { id: "", text: "Built an OCR pipeline for passports, cutting verification time by 40%.", source: OCR },
              { id: "", text: "Collaborated with senior developers in an agile environment, improving code quality.", source: OCR },
              { id: "", text: "Developed web features for internal tools.", source: "S99" },
            ],
          },
          { id: "", title: "Senior Engineer", org: "Nowhere Ltd", date: "", location: "", links: [], bullets: [] },
        ],
      },
      SOURCE,
    );
    expect(cv.about).toBe("Fullstack developer with hands-on RAG and OCR work at E-Avenue.");
    expect(cv.skillGroups[0].skills.map((s) => s.name)).toEqual(["React"]);
    expect(cv.experience).toHaveLength(1);
    expect(cv.experience[0].bullets.map((b) => b.text)).toEqual(["Designed and built a RAG-based AI copilot for Jira that queries internal knowledge bases."]);
    expect(cv.experience[0].bullets[0]).not.toHaveProperty("source");
    expect(dropped.map((d) => d.split(" — ")[1]).sort()).toEqual(
      [
        "not in your CV: Vue",
        "not in your CV: 40",
        'goes beyond what your CV says ("I developed an OCR pipeline for passports.")',
        "no sentence in your CV says this",
        "not in your CV: Senior, Engineer",
      ].sort(),
    );
  });
});
