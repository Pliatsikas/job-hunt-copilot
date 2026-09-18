import { describe, expect, it } from "vitest";
import { numberedSentences, resolveSource, splitSentences } from "./sentences";

describe("sentences", () => {
  const text = "Alexandros Pliatsikas\nPROFILE\nI build apps. I ship them; often.\nSkills: React, Next.js";
  it("splits on sentence ends and line breaks, numbers from 1", () => {
    const s = splitSentences(text);
    expect(s).toEqual(["Alexandros Pliatsikas", "PROFILE", "I build apps.", "I ship them;", "often.", "Skills: React, Next.js"]);
    expect(numberedSentences(s).split("\n")[2]).toBe("S3| I build apps.");
  });
  it("resolves one or two references and refuses anything else", () => {
    const s = splitSentences(text);
    expect(resolveSource("S3", s)).toBe("I build apps.");
    expect(resolveSource("S3,S4", s)).toBe("I build apps. I ship them;");
    expect(resolveSource("S99", s)).toBeNull();
    expect(resolveSource("", s)).toBeNull();
    expect(resolveSource("I build apps.", s)).toBeNull();
  });
});
