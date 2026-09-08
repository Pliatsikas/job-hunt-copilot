import { describe, expect, it } from "vitest";
import { applicationFiltersSchema, applicationFormSchema } from "./application";

const valid = {
  roleTitle: "Backend Engineer",
  companyName: "",
  jobUrl: "",
  jobDescription: "We need Postgres and TypeScript.",
  source: "",
  location: "",
  workMode: "ONSITE",
  salaryNote: "",
  status: "SAVED",
  appliedAt: "",
  nextActionAt: "",
};

describe("applicationFormSchema", () => {
  it("emits null for blank optional fields, so clearing one actually clears it", () => {
    // Prisma skips undefined on update — undefined here would mean an emptied
    // box silently keeps its old value.
    const parsed = applicationFormSchema.parse(valid);
    expect(parsed.source).toBeNull();
    expect(parsed.location).toBeNull();
    expect(parsed.salaryNote).toBeNull();
    expect(parsed.jobUrl).toBeNull();
    expect(parsed.companyName).toBeNull();
  });

  it("emits null for blank dates rather than dropping them from the update", () => {
    const parsed = applicationFormSchema.parse(valid);
    expect(parsed.appliedAt).toBeNull();
    expect(parsed.nextActionAt).toBeNull();
  });

  it("coerces a date input value", () => {
    const parsed = applicationFormSchema.parse({ ...valid, appliedAt: "2026-09-01" });
    expect(parsed.appliedAt?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("requires a role title and a job description", () => {
    expect(applicationFormSchema.safeParse({ ...valid, roleTitle: "" }).success).toBe(false);
    expect(applicationFormSchema.safeParse({ ...valid, jobDescription: "" }).success).toBe(false);
  });

  it("rejects a malformed job URL", () => {
    expect(applicationFormSchema.safeParse({ ...valid, jobUrl: "not-a-url" }).success).toBe(false);
  });

  it("defaults workMode and status", () => {
    const rest: Record<string, string> = { ...valid };
    delete rest.workMode;
    delete rest.status;
    const parsed = applicationFormSchema.parse(rest);
    expect(parsed.workMode).toBe("ONSITE");
    expect(parsed.status).toBe("SAVED");
  });
});

describe("applicationFiltersSchema", () => {
  it("falls back to defaults instead of throwing on junk searchParams", () => {
    const parsed = applicationFiltersSchema.parse({ status: "NONSENSE", sort: "bogus", dir: "up" });
    expect(parsed.status).toBeUndefined();
    expect(parsed.sort).toBe("created");
    expect(parsed.dir).toBe("desc");
  });

  it("keeps valid filters", () => {
    const parsed = applicationFiltersSchema.parse({ status: "APPLIED", q: "postgres", dir: "asc" });
    expect(parsed.status).toBe("APPLIED");
    expect(parsed.q).toBe("postgres");
    expect(parsed.dir).toBe("asc");
  });
});
