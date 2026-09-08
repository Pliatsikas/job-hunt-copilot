import { describe, expect, it } from "vitest";
import { normalizeSkills, profileFormSchema } from "./profile";

describe("normalizeSkills", () => {
  it("lowercases and trims", () => {
    expect(normalizeSkills(["  React ", "TypeScript"])).toEqual(["react", "typescript"]);
  });

  it("de-duplicates case-insensitively", () => {
    expect(normalizeSkills(["React", "react", "REACT"])).toEqual(["react"]);
  });

  it("splits a comma-separated paste into separate skills", () => {
    expect(normalizeSkills(["react, next.js , postgres"])).toEqual([
      "react",
      "next.js",
      "postgres",
    ]);
  });

  it("collapses internal whitespace so 'node  js' and 'node js' are one skill", () => {
    expect(normalizeSkills(["node  js", "node js"])).toEqual(["node js"]);
  });

  it("drops blanks and non-strings rather than storing empty tags", () => {
    expect(normalizeSkills(["", "   ", ",,", 42, null, "docker"])).toEqual(["docker"]);
  });

  it("accepts a single string as well as an array", () => {
    expect(normalizeSkills("Docker")).toEqual(["docker"]);
  });
});

describe("profileFormSchema", () => {
  const valid = { headline: "", location: "", yearsOfExp: "2", cvText: "x", skills: ["React"] };

  it("normalizes skills through the schema, not just the editor", () => {
    const parsed = profileFormSchema.parse({ ...valid, skills: ["React", "react", " Docker "] });
    expect(parsed.skills).toEqual(["react", "docker"]);
  });

  it("coerces yearsOfExp from the form's string", () => {
    expect(profileFormSchema.parse(valid).yearsOfExp).toBe(2);
  });

  it("treats a blank yearsOfExp as zero", () => {
    expect(profileFormSchema.parse({ ...valid, yearsOfExp: "" }).yearsOfExp).toBe(0);
  });

  it("rejects negative experience", () => {
    expect(profileFormSchema.safeParse({ ...valid, yearsOfExp: "-1" }).success).toBe(false);
  });

  it("requires cvText — there is nothing to ground against without it", () => {
    expect(profileFormSchema.safeParse({ ...valid, cvText: "" }).success).toBe(false);
  });

  it("emits null for blank headline and location, so clearing a field sticks", () => {
    // Not undefined: Prisma skips undefined on update, which would silently
    // keep the previous value instead of clearing it.
    const parsed = profileFormSchema.parse(valid);
    expect(parsed.headline).toBeNull();
    expect(parsed.location).toBeNull();
  });

  it("accepts a short cvText — thinness is a warning, not a validation error", () => {
    expect(profileFormSchema.safeParse({ ...valid, cvText: "short" }).success).toBe(true);
  });
});
