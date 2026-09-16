import { describe, expect, it } from "vitest";
import { jobPreferencesFormSchema, preferenceSuggestionSchema } from "./job-preferences";

const base = {
  targetRoles: ["Fullstack Developer", "frontend developer", "fullstack developer"],
  city: "Thessaloniki",
  country: "Greece",
  remote: "REMOTE_OK",
  seniority: "JUNIOR",
  languages: ["el", "en"],
  excludeKeywords: ["Sales"],
  autoSearch: true,
};

describe("jobPreferencesFormSchema", () => {
  it("lowercases and de-duplicates roles, keeping order", () => {
    const out = jobPreferencesFormSchema.parse(base);
    expect(out.targetRoles).toEqual(["fullstack developer", "frontend developer"]);
    expect(out.excludeKeywords).toEqual(["sales"]);
  });

  it("requires at least one role — no roles, no search", () => {
    const out = jobPreferencesFormSchema.safeParse({ ...base, targetRoles: [] });
    expect(out.success).toBe(false);
  });

  it("caps roles at eight, since they become search keywords", () => {
    const many = Array.from({ length: 12 }, (_, i) => `role ${i}`);
    expect(jobPreferencesFormSchema.parse({ ...base, targetRoles: many }).targetRoles).toHaveLength(8);
  });

  it("turns empty text fields into null and an empty seniority into null", () => {
    const out = jobPreferencesFormSchema.parse({ ...base, city: "  ", country: "", seniority: "" });
    expect(out.city).toBeNull();
    expect(out.country).toBeNull();
    expect(out.seniority).toBeNull();
  });

  it("rejects an unknown remote preference or language", () => {
    expect(jobPreferencesFormSchema.safeParse({ ...base, remote: "MAYBE" }).success).toBe(false);
    expect(jobPreferencesFormSchema.safeParse({ ...base, languages: ["fr"] }).success).toBe(false);
  });
});

describe("preferenceSuggestionSchema", () => {
  it("accepts what the model is allowed to say and nothing about remote or exclusions", () => {
    const out = preferenceSuggestionSchema.parse({
      targetRoles: ["fullstack developer"],
      seniority: "JUNIOR",
      city: "Thessaloniki",
      country: "Greece",
      rationale: "React and Node in production.",
    });
    expect(out.targetRoles).toEqual(["fullstack developer"]);
    expect("remote" in out).toBe(false);
  });

  it("insists on at least one role", () => {
    expect(
      preferenceSuggestionSchema.safeParse({ targetRoles: [], seniority: null, city: null, country: null, rationale: "x" }).success,
    ).toBe(false);
  });
});
