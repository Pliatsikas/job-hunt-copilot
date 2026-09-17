import { describe, expect, it } from "vitest";
import { EMPTY_CV, type StructuredCv } from "../schemas/structured-cv";
import { applySelection } from "./select";

const entry = (id: string, n: number) => ({
  id,
  title: `T ${id}`,
  org: "",
  date: "",
  location: "",
  links: [],
  bullets: Array.from({ length: n }, (_, i) => ({ id: `${id}-b${i + 1}`, text: `bullet ${i + 1}` })),
});

const source: StructuredCv = {
  ...EMPTY_CV,
  name: "A",
  about: "About me",
  skillGroups: [{ id: "g1", label: "Frontend", skills: [{ id: "s1", name: "React" }, { id: "s2", name: "Vue" }, { id: "s3", name: "Svelte" }] }],
  certifications: [{ id: "c1", name: "Cert", issuer: "", year: "" }],
  experience: [entry("exp-1", 3), entry("exp-2", 2)],
  education: [entry("edu-1", 1)],
  projects: [entry("proj-1", 2), entry("proj-2", 1)],
};

describe("applySelection", () => {
  it("keeps only chosen ids, in source order for skills and bullets, and drops unknown ids", () => {
    const { cv, unknownIds } = applySelection(source, {
      keepAbout: false,
      skillGroups: [{ id: "g1", skills: ["s3", "s1", "ghost"] }],
      experience: [{ id: "exp-2", bullets: ["exp-2-b2"] }, { id: "exp-1", bullets: ["exp-1-b3", "exp-1-b1", "nope"] }],
      education: [],
      projects: [{ id: "proj-2", bullets: ["proj-2-b1"] }, { id: "proj-9", bullets: [] }],
      certifications: ["c1", "c9"],
      keywordsAddressed: [],
    });
    expect(cv.about).toBe("");
    expect(cv.skillGroups[0].skills.map((s) => s.id)).toEqual(["s1", "s3"]);
    expect(cv.experience.map((e) => e.id)).toEqual(["exp-2", "exp-1"]);
    expect(cv.experience[1].bullets.map((b) => b.id)).toEqual(["exp-1-b1", "exp-1-b3"]);
    // Education is never the model's to drop.
    expect(cv.education.map((e) => e.id)).toEqual(["edu-1"]);
    expect(cv.projects.map((e) => e.id)).toEqual(["proj-2"]);
    expect(cv.certifications.map((c) => c.id)).toEqual(["c1"]);
    expect(unknownIds.sort()).toEqual(["c9", "ghost", "nope", "proj-9"]);
  });

  it("keeps every role even if the model dropped one, and all bullets of an entry chosen with none", () => {
    const { cv } = applySelection(source, {
      keepAbout: true,
      skillGroups: [],
      experience: [{ id: "exp-2", bullets: [] }],
      education: [],
      projects: [],
      certifications: [],
      keywordsAddressed: [],
    });
    expect(cv.experience.map((e) => e.id)).toEqual(["exp-2", "exp-1"]);
    expect(cv.experience[0].bullets).toHaveLength(2);
    expect(cv.experience[1].bullets).toHaveLength(3);
    expect(cv.about).toBe("About me");
  });
});
