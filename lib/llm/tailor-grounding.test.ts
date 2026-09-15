import { describe, expect, it } from "vitest";
import { cvLines, groundTailoredCv, renderTailoredCv } from "./tailor-grounding";

const CV = [
  "Alexandros — Junior Fullstack Developer, Thessaloniki.",
  "PROFILE",
  "I build React frontends with TypeScript and Next.js for production applications.",
  "I design PostgreSQL schemas and write REST APIs in Node.js with Express.",
  "PROJECTS",
  "TaskFlow, a fullstack task management SaaS, 2026.",
  "Game development with Unity, ongoing personal work.",
  "EDUCATION",
  "BSc in Applied Informatics at the University of Macedonia, 2022 to present.",
].join("\n");

const out = (lines: string[], heading: "PROFILE" | "PROJECTS" = "PROFILE") => ({
  sections: [{ heading, lines }],
  keywordsAddressed: [],
});

describe("groundTailoredCv", () => {
  it("keeps a line that is the CV's own, and stores the CV's text not the copy", () => {
    // Curly quotes and case are normalization, not edits — but what is saved
    // is the original line, so the CV's own characters survive.
    const g = groundTailoredCv(
      out(["i build react frontends with typescript and next.js for production applications."]),
      CV,
      [],
    );
    expect(g.cv.sections[0].lines).toEqual([
      "I build React frontends with TypeScript and Next.js for production applications.",
    ]);
    expect(g.droppedLines).toEqual([]);
  });

  it("drops a rephrased line — the owner's words or nothing", () => {
    const g = groundTailoredCv(
      out(["I build production React frontends with TypeScript and Next.js."]),
      CV,
      [],
    );
    expect(g.cv.sections).toEqual([]);
    expect(g.droppedLines).toHaveLength(1);
  });

  it("drops a half line — substring is not enough here", () => {
    // The analysis's grounding accepts a substring as evidence. A tailored CV
    // presents the line as the CV; half of it is an edit.
    const g = groundTailoredCv(out(["I build React frontends with TypeScript"]), CV, []);
    expect(g.droppedLines).toHaveLength(1);
  });

  it("drops two lines merged into one", () => {
    const g = groundTailoredCv(
      out([
        "I build React frontends with TypeScript and Next.js for production applications. I design PostgreSQL schemas and write REST APIs in Node.js with Express.",
      ]),
      CV,
      [],
    );
    expect(g.droppedLines).toHaveLength(1);
  });

  it("drops an invented line and reports it rather than hiding it", () => {
    const g = groundTailoredCv(
      out(["Led a team of five engineers delivering a Kubernetes migration."]),
      CV,
      ["kubernetes"],
    );
    expect(g.droppedLines).toEqual([
      "Led a team of five engineers delivering a Kubernetes migration.",
    ]);
  });

  it("keeps the first of a repeated line and counts the rest", () => {
    const line = "TaskFlow, a fullstack task management SaaS, 2026.";
    const g = groundTailoredCv(
      { sections: [{ heading: "PROJECTS", lines: [line] }, { heading: "PROFILE", lines: [line] }], keywordsAddressed: [] },
      CV,
      [],
    );
    expect(g.cv.sections).toHaveLength(1);
    expect(g.duplicateLines).toBe(1);
  });

  it("removes a section that ends up empty", () => {
    const g = groundTailoredCv(
      {
        sections: [
          { heading: "PROFILE", lines: ["Not in the CV at all."] },
          { heading: "PROJECTS", lines: ["TaskFlow, a fullstack task management SaaS, 2026."] },
        ],
        keywordsAddressed: [],
      },
      CV,
      [],
    );
    expect(g.cv.sections.map((s) => s.heading)).toEqual(["PROJECTS"]);
  });

  it("reports coverage as the share of CV lines used", () => {
    const g = groundTailoredCv(
      out(["TaskFlow, a fullstack task management SaaS, 2026."], "PROJECTS"),
      CV,
      [],
    );
    expect(g.coverage).toBeCloseTo(1 / cvLines(CV).length);
  });

  it("cannot fabricate by construction, and says so with a zero", () => {
    const g = groundTailoredCv(
      out(["Game development with Unity, ongoing personal work."], "PROJECTS"),
      CV,
      ["kubernetes", "laravel"],
    );
    expect(g.fabrications).toBe(0);
  });
});

describe("renderTailoredCv", () => {
  it("writes headings in caps with the lines beneath, sections blank-line separated", () => {
    const text = renderTailoredCv({
      sections: [
        { heading: "PROFILE", lines: ["a", "b"] },
        { heading: "EDUCATION", lines: ["c"] },
      ],
      keywordsAddressed: [],
    });
    expect(text).toBe("PROFILE\na\nb\n\nEDUCATION\nc");
  });
});
