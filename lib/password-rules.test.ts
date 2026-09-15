import { describe, expect, it } from "vitest";
import {
  firstUnmetRuleLabel,
  PASSWORD_RULES,
  passwordMeetsRules,
  unmetPasswordRules,
} from "./password-rules";

describe("password rules", () => {
  it("accepts a password that meets every rule", () => {
    expect(passwordMeetsRules("Kalimera2026!")).toBe(true);
    expect(unmetPasswordRules("Kalimera2026!")).toEqual([]);
  });

  it("names every rule a weak password misses, in list order", () => {
    expect(unmetPasswordRules("abc")).toEqual(["length", "upper", "digit", "symbol"]);
  });

  it("counts a Greek capital as uppercase and a Greek small letter as lowercase", () => {
    // ASCII [A-Z] would report no capitals here.
    expect(unmetPasswordRules("ΚΑΛΗΜΕΡΑ2026!")).toEqual(["lower"]);
    expect(unmetPasswordRules("καλημέρα2026!")).toEqual(["upper"]);
    expect(passwordMeetsRules("Καλημέρα2026!")).toBe(true);
  });

  it("counts a non-ASCII digit as a number", () => {
    expect(unmetPasswordRules("Kalimera٢٠٢٦!")).toEqual([]);
  });

  it("measures length in characters, not UTF-16 code units", () => {
    // Four emoji are four characters, eight code units.
    expect(unmetPasswordRules("Ab1!😀😀😀😀")).toEqual(["length"]);
    expect(unmetPasswordRules("Ab1!😀😀😀😀😀😀")).toEqual([]);
  });

  it("refuses the passwords every script tries first, whatever the casing", () => {
    expect(unmetPasswordRules("Password1!")).toEqual(["common"]);
    expect(unmetPasswordRules("PASSWORD1!")).toContain("common");
  });

  it("does not treat a space as a symbol", () => {
    expect(unmetPasswordRules("Kalimera 2026")).toEqual(["symbol"]);
  });

  it("returns a readable message naming the first unmet rule", () => {
    expect(firstUnmetRuleLabel("short")).toBe("Password needs: at least 10 characters");
    expect(firstUnmetRuleLabel("Kalimera2026!")).toBeNull();
  });

  it("has unique ids, since the checklist keys on them", () => {
    const ids = PASSWORD_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
