import { describe, expect, it } from "vitest";
import { dedupeKey } from "./dedupe";

describe("dedupeKey", () => {
  it("collapses case, punctuation and whitespace", () => {
    expect(dedupeKey("Acme, Inc.", "Senior Frontend Engineer")).toBe(
      dedupeKey("ACME INC", "senior  frontend engineer"),
    );
  });

  it("ignores bracketed tags and gender markers common on EU postings", () => {
    expect(dedupeKey("Acme", "Fullstack Developer (m/w/d)")).toBe(
      dedupeKey("Acme", "Fullstack Developer [Remote]"),
    );
    expect(dedupeKey("Acme", "Fullstack Developer - Remote")).toBe(dedupeKey("Acme", "Fullstack Developer"));
  });

  it("keeps different roles at the same company apart", () => {
    expect(dedupeKey("Acme", "Frontend Engineer")).not.toBe(dedupeKey("Acme", "Backend Engineer"));
  });

  it("keeps the same role at different companies apart", () => {
    expect(dedupeKey("Acme", "Engineer")).not.toBe(dedupeKey("Beta", "Engineer"));
  });

  it("works on Greek titles", () => {
    expect(dedupeKey("Εταιρεία Α.Ε.", "Προγραμματιστής Full Stack")).toBe(
      dedupeKey("εταιρεια αε", "προγραμματιστής full stack"),
    );
  });
});
