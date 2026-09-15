import { describe, expect, it } from "vitest";
import { assessImportQuality, FRAGMENTED_BELOW } from "./quality";

describe("assessImportQuality", () => {
  it("counts lines the grounding check could quote", () => {
    const q = assessImportQuality([
      "I build React frontends with TypeScript and Next.js.",
      "Skills",
      "I design PostgreSQL schemas and write REST APIs.",
    ]);
    expect(q.lines).toBe(3);
    expect(q.quotableLines).toBe(2);
    expect(q.fragmented).toBe(false);
  });

  it("flags a fragmented extraction — the two-column failure", () => {
    // What a sidebar interleaved into prose looks like after extraction.
    const q = assessImportQuality([
      "React,", "Next.js,", "TypeScript", "Node.js,", "Express,",
      "I build production-ready applications end to end.",
    ]);
    expect(q.quotableShare).toBeLessThan(FRAGMENTED_BELOW);
    expect(q.fragmented).toBe(true);
  });

  it("ignores blank lines rather than counting them as fragments", () => {
    const q = assessImportQuality(["", "I build React frontends with TypeScript.", "  ", ""]);
    expect(q.lines).toBe(1);
    expect(q.quotableLines).toBe(1);
  });

  it("is not fragmented when empty — there is nothing to judge", () => {
    expect(assessImportQuality([]).fragmented).toBe(false);
  });
});
