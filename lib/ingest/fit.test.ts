import { describe, expect, it } from "vitest";
import { scoreFit, type FitPreferences } from "./fit";

const prefs: FitPreferences = {
  targetRoles: ["fullstack developer", "frontend developer"],
  skills: ["react", "typescript", "node.js", "postgresql", "docker"],
  city: "Thessaloniki",
  country: "Greece",
  remote: "REMOTE_OK",
  seniority: "JUNIOR",
  excludeKeywords: ["sales", "unpaid"],
};

const job = (over: Partial<Parameters<typeof scoreFit>[0]>) => ({
  title: "Software Engineer",
  description: "",
  location: null,
  remote: null,
  ...over,
});

describe("scoreFit", () => {
  it("ranks a matching role in the city above everything else", () => {
    const a = scoreFit(job({ title: "Fullstack Developer", description: "React, Node.js, PostgreSQL and Docker in production.", location: "Thessaloniki, Greece" }), prefs);
    const b = scoreFit(job({ title: "Warehouse Manager", description: "Forklift licence required.", location: "Aspropyrgos, Greece" }), prefs);
    expect(a.score!).toBeGreaterThan(85);
    expect(b.score!).toBeLessThan(20);
    expect(a.matchedTerms).toEqual(expect.arrayContaining(["role: fullstack developer", "skill: react", "in Thessaloniki"]));
  });

  it("disqualifies on an exclude keyword and says which", () => {
    const f = scoreFit(job({ title: "Fullstack Developer", description: "This is a sales-driven role." }), prefs);
    expect(f.score).toBeNull();
    expect(f.excludedBy).toBe("sales");
  });

  it("does not let 'sales' match 'salesforce'", () => {
    const f = scoreFit(job({ title: "Frontend Developer", description: "We integrate with Salesforce." }), prefs);
    expect(f.excludedBy).toBeNull();
  });

  it("recognises the city in Greek script and without accents", () => {
    const el = scoreFit(job({ title: "Frontend Developer", location: "Θεσσαλονίκη" }), prefs);
    const plain = scoreFit(job({ title: "Frontend Developer", location: "Thessaloniki" }), prefs);
    expect(el.matchedTerms).toContain("in Thessaloniki");
    expect(el.score).toBe(plain.score);
  });

  it("credits remote when remote is acceptable, and penalises its absence when it is required", () => {
    const ok = scoreFit(job({ title: "Frontend Developer", remote: true }), prefs);
    expect(ok.matchedTerms).toContain("remote");
    const onlyPrefs = { ...prefs, remote: "REMOTE_ONLY" as const };
    const onsite = scoreFit(job({ title: "Frontend Developer", location: "Athens, Greece" }), onlyPrefs);
    const remote = scoreFit(job({ title: "Frontend Developer", remote: true }), onlyPrefs);
    expect(remote.score!).toBeGreaterThan(onsite.score!);
  });

  it("gives partial credit for role words in the title without the full role", () => {
    const f = scoreFit(job({ title: "Frontend Engineer" }), prefs);
    expect(f.score!).toBeGreaterThan(0);
    expect(f.score!).toBeLessThan(45);
  });

  it("caps skills so a keyword-stuffed posting cannot outrank a real fit", () => {
    const stuffed = scoreFit(job({ title: "Anything", description: "react typescript node.js postgresql docker react typescript" }), prefs);
    expect(stuffed.score!).toBeLessThanOrEqual(30 + 20);
  });

  it("stays within 0–100", () => {
    const f = scoreFit(job({ title: "Fullstack Developer Frontend Developer", description: prefs.skills.join(" "), location: "Thessaloniki, Greece", remote: true }), prefs);
    expect(f.score).toBeLessThanOrEqual(100);
  });
});

describe("scoreFit — lessons from the first live run", () => {
  it("matches 'Full Stack Developer' to the role 'fullstack developer'", () => {
    // The Greek market's spelling; not one Athens title matched before.
    const f = scoreFit(job({ title: "Full Stack Developer", location: "Athens, Greece" }), prefs);
    expect(f.matchedTerms).toContain("role: fullstack developer");
    expect(scoreFit(job({ title: "Front-End Developer" }), prefs).matchedTerms).toContain("role: frontend developer");
  });

  it("ranks an Athens posting above the same role in Bangalore", () => {
    const athens = scoreFit(job({ title: "Fullstack Developer", location: "Athens, Greece" }), prefs);
    const bangalore = scoreFit(job({ title: "Fullstack Developer", location: "Bangalore, India" }), prefs);
    expect(athens.score!).toBeGreaterThan(bangalore.score! + 30);
  });

  it("does not give a QA role credit for the word 'engineer'", () => {
    const qa = scoreFit(job({ title: "Senior QA Engineer", description: "react typescript node.js" }), prefs);
    const fe = scoreFit(job({ title: "Frontend Engineer", description: "react typescript node.js" }), prefs);
    expect(fe.score!).toBeGreaterThan(qa.score!);
  });

  it("penalises senior titles for a junior, and credits junior ones", () => {
    const senior = scoreFit(job({ title: "Senior Frontend Developer", location: "Athens, Greece" }), prefs);
    const junior = scoreFit(job({ title: "Junior Frontend Developer", location: "Athens, Greece" }), prefs);
    expect(junior.score!).toBeGreaterThan(senior.score! + 20);
    expect(junior.matchedTerms).toContain("junior role");
  });
});

describe("remote detection", () => {
  it("ignores 'remote' in the body — boilerplate says it about jobs that are not", () => {
    const office = scoreFit(job({ title: "Backend Engineer", description: "We do not offer remote work.", location: "Helsinki, Finland" }), prefs);
    expect(office.matchedTerms).not.toContain("remote");
    expect(office.score!).toBeLessThan(30);
  });
  it("trusts the title, the location field and the source flag", () => {
    expect(scoreFit(job({ title: "Backend Engineer (Remote)" }), prefs).matchedTerms).toContain("remote");
    expect(scoreFit(job({ title: "Backend Engineer", location: "Remote - Europe" }), prefs).matchedTerms).toContain("remote");
    expect(scoreFit(job({ title: "Backend Engineer", remote: true }), prefs).matchedTerms).toContain("remote");
  });
});
