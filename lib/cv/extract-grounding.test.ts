import { describe, expect, it } from "vitest";
import { EMPTY_CV } from "../schemas/structured-cv";
import { groundExtraction } from "./extract-grounding";

const SOURCE = `Alexandros Pliatsikas
Applied Informatics · Fullstack & AI Development
Web Developer Intern · E-Avenue — Mar 2026 – May 2026
- Designed and built a RAG-based AI copilot for Jira.
- Developed an OCR pipeline for passports.
Skills: React, Next.js, TypeScript`;

describe("groundExtraction", () => {
  it("keeps exact copies (whitespace and dash style aside) and drops the rest", () => {
    const { cv, dropped } = groundExtraction(
      {
        ...EMPTY_CV,
        name: "Alexandros Pliatsikas",
        subtitle: "Applied Informatics · Fullstack & AI Development",
        about: "A summary the model wrote itself.",
        skillGroups: [{ id: "", label: "Skills", skills: [{ id: "", name: "React" }, { id: "", name: "Vue" }] }],
        experience: [
          {
            id: "",
            title: "Web Developer Intern",
            org: "E-Avenue",
            date: "Mar 2026 - May 2026",
            location: "",
            links: [],
            bullets: [
              { id: "", text: "Designed and built a RAG-based AI copilot for Jira." },
              { id: "", text: "Designed and built an AI copilot for Jira." },
            ],
          },
          { id: "", title: "Senior Engineer", org: "Nowhere", date: "", location: "", links: [], bullets: [] },
        ],
      },
      SOURCE,
    );
    expect(cv.name).toBe("Alexandros Pliatsikas");
    expect(cv.subtitle).toBe("Applied Informatics · Fullstack & AI Development");
    expect(cv.about).toBe("");
    expect(cv.skillGroups[0].skills.map((s) => s.name)).toEqual(["React"]);
    expect(cv.experience).toHaveLength(1);
    expect(cv.experience[0].bullets).toHaveLength(1);
    expect(cv.experience[0].date).toBe("Mar 2026 - May 2026");
    expect(dropped.sort()).toEqual(
      ["A summary the model wrote itself.", "Vue", "Designed and built an AI copilot for Jira.", "Senior Engineer"].sort(),
    );
  });
});
