import { describe, expect, it } from "vitest";
import { EMPTY_CV, type StructuredCv } from "../schemas/structured-cv";
import { applySelection, renderStructuredCvText } from "./select";
import { CV_LABELS } from "../schemas/structured-cv";

const entry = (id: string, texts: string[]) => ({
  id,
  title: `Role ${id}`,
  org: "Acme",
  date: "2025",
  location: "",
  links: [],
  bullets: texts.map((text, i) => ({ id: `${id}-b${i + 1}`, text })),
});

const source: StructuredCv = {
  ...EMPTY_CV,
  name: "A",
  about: "About me",
  skillGroups: [{ id: "g1", label: "Frontend", skills: [{ id: "s1", name: "React" }, { id: "s2", name: "Vue" }, { id: "s3", name: "Svelte" }] }],
  certifications: [{ id: "c1", name: "Cert", issuer: "", year: "" }],
  experience: [entry("exp-1", ["Built a REST API with Node.js and PostgreSQL.", "Wrote tests.", "Deployed with Docker."]), entry("exp-2", ["Supported customers.", "Managed tickets in a CRM."])],
  education: [entry("edu-1", ["Thesis on RAG pipelines."])],
  projects: [entry("proj-1", ["Kanban app with Socket.io.", "JWT auth."]), entry("proj-2", ["A game in Unity."])],
};
const sourceText = renderStructuredCvText(source, CV_LABELS.en);
const keep = (id: string) => ({ id, text: "" });

describe("applySelection", () => {
  it("keeps only chosen ids, in source order for skills and bullets, and drops unknown ids", () => {
    const { cv, unknownIds } = applySelection(
      source,
      {
        keepAbout: false,
        about: "",
        skillGroups: [{ id: "g1", skills: ["s3", "s1", "ghost"] }],
        experience: [{ id: "exp-2", bullets: [keep("exp-2-b2")] }, { id: "exp-1", bullets: [keep("exp-1-b3"), keep("exp-1-b1"), keep("nope")] }],
        education: [],
        projects: [{ id: "proj-2", bullets: [keep("proj-2-b1")] }, { id: "proj-9", bullets: [] }],
        certifications: ["c1", "c9"],
        keywordsAddressed: [],
      },
      "en",
      sourceText,
    );
    expect(cv.about).toBe("");
    // Skills are reordered as asked (s3 first, s1), never dropped (s2 stays, last).
    expect(cv.skillGroups[0].skills.map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
    expect(cv.experience.map((e) => e.id)).toEqual(["exp-2", "exp-1"]);
    expect(cv.experience[1].bullets.map((b) => b.id)).toEqual(["exp-1-b1", "exp-1-b3"]);
    expect(cv.education.map((e) => e.id)).toEqual(["edu-1"]);
    expect(cv.projects.map((e) => e.id)).toEqual(["proj-2"]);
    expect(cv.certifications.map((c) => c.id)).toEqual(["c1"]);
    expect(unknownIds.sort()).toEqual(["c9", "ghost", "nope", "proj-9"]);
  });

  it("keeps every role even if the model dropped one, and all bullets of an entry chosen with none", () => {
    const { cv } = applySelection(
      source,
      { keepAbout: true, about: "", skillGroups: [], experience: [{ id: "exp-2", bullets: [] }], education: [], projects: [], certifications: [], keywordsAddressed: [] },
      "en",
      sourceText,
    );
    expect(cv.experience.map((e) => e.id)).toEqual(["exp-2", "exp-1"]);
    expect(cv.experience[0].bullets).toHaveLength(2);
    expect(cv.experience[1].bullets).toHaveLength(3);
    expect(cv.about).toBe("About me");
  });

  it("uses a rewrite when its facts and words are the CV's, refuses an invented fact, the wrong language, or a sentence that says more", () => {
    const { cv, changes, rejected } = applySelection(
      source,
      {
        keepAbout: true,
        about: "About me: REST APIs on Node.js and PostgreSQL, deployed with Docker.",
        skillGroups: [],
        experience: [
          {
            id: "exp-1",
            bullets: [
              { id: "exp-1-b1", text: "Built REST APIs on Node.js and PostgreSQL, deployed with Docker." },
              { id: "exp-1-b2", text: "Wrote unit tests in Jest with 95% coverage." },
              { id: "exp-1-b3", text: "Ανέπτυξα deployments με Docker." },
            ],
          },
          {
            id: "exp-2",
            bullets: [
              { id: "exp-2-b1", text: "Led agile ceremonies and mentored junior colleagues across departments." },
            ],
          },
        ],
        education: [],
        projects: [],
        certifications: [],
        keywordsAddressed: ["REST APIs"],
      },
      "en",
      sourceText,
    );
    expect(cv.about).toContain("deployed with Docker");
    expect(cv.experience[0].bullets.map((b) => b.text)).toEqual([
      "Built REST APIs on Node.js and PostgreSQL, deployed with Docker.",
      "Wrote tests.",
      "Deployed with Docker.",
    ]);
    expect(changes.map((c) => c.id)).toEqual(["about", "exp-1-b1"]);
    expect(cv.experience[1].bullets[0].text).toBe("Supported customers.");
    expect(rejected.map((r) => [r.id, r.reason])).toEqual([
      ["exp-1-b2", "not in your CV: Jest, 95"],
      ["exp-1-b3", "wrong language"],
      ["exp-2-b1", "says more than your CV does"],
    ]);
  });

  it("lets a rewrite use the posting's allowed keywords anywhere, but never a gap", () => {
    const sel = {
      keepAbout: true,
      about: "",
      skillGroups: [],
      experience: [{ id: "exp-1", bullets: [{ id: "exp-1-b1", text: "Built RESTful microservices with Node.js and PostgreSQL." }] }],
      education: [],
      projects: [{ id: "proj-2", bullets: [{ id: "proj-2-b1", text: "A game in Unity, deployed on Kubernetes." }] }],
      certifications: [],
      keywordsAddressed: [],
    };
    const { cv, rejected } = applySelection(source, sel, "en", sourceText, ["RESTful microservices", "Docker"]);
    expect(cv.experience[0].bullets[0].text).toBe("Built RESTful microservices with Node.js and PostgreSQL.");
    expect(rejected.map((r) => r.reason)).toEqual(["not in your CV: Kubernetes"]);
  });

  it("keeps every skill group and certification when the model returns none", () => {
    const { cv } = applySelection(
      source,
      { keepAbout: true, about: "", skillGroups: [], experience: [], education: [], projects: [], certifications: [], keywordsAddressed: [] },
      "en",
      sourceText,
    );
    expect(cv.skillGroups.map((g) => g.skills.length)).toEqual([3]);
    expect(cv.certifications).toHaveLength(1);
  });

  it("refuses a rewrite that inflates seniority", () => {
    const { cv, rejected } = applySelection(
      source,
      { keepAbout: true, about: "Seasoned developer with extensive experience in REST APIs on Node.js and PostgreSQL.", skillGroups: [], experience: [], education: [], projects: [], certifications: [], keywordsAddressed: [] },
      "en",
      sourceText,
    );
    expect(cv.about).toBe("About me");
    expect(rejected[0].reason).toBe("claims a level your CV does not: Seasoned, extensive experience");
  });

  it("refuses a rewrite that borrows a technology from another entry", () => {
    const { cv, rejected } = applySelection(
      source,
      {
        keepAbout: true,
        about: "",
        skillGroups: [],
        experience: [],
        education: [],
        // Socket.io is real, but it belongs to proj-1, not to the Unity game.
        projects: [{ id: "proj-2", bullets: [{ id: "proj-2-b1", text: "A game in Unity with Socket.io multiplayer." }] }],
        certifications: [],
        keywordsAddressed: [],
      },
      "en",
      sourceText,
    );
    expect(cv.projects[0].bullets[0].text).toBe("A game in Unity.");
    expect(rejected).toEqual([{ id: "proj-2-b1", text: "A game in Unity with Socket.io multiplayer.", reason: "not part of this entry: Socket.io" }]);
  });
});
