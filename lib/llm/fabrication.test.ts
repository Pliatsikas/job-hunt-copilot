import { describe, expect, it } from "vitest";
import { findFabricatedClaims } from "./fabrication";

// The actual sentence generated during M5, before the prompt was tightened.
const REAL_REGRESSION =
  "Παρόλο που η μέχρι τώρα εμπειρία μου επικεντρώνεται κυρίως στο οικοσύστημα της JavaScript, αυτή την περίοδο αναπτύσσω μια πλήρη CRUD εφαρμογή με Laravel, Eloquent ORM και Blade templates.";

// The sentence produced after the fix.
const REAL_FIXED =
  "Παρόλο που η μέχρι τώρα εμπειρία μου επικεντρώνεται κυρίως σε Javascript, Node.js και React, έχοντας ολοκληρώσει πιστοποιημένα σεμινάρια στη γλώσσα PHP, είμαι έτοιμος να εμβαθύνω άμεσα στο οικοσύστημα του Laravel Framework.";

describe("findFabricatedClaims", () => {
  it("catches the exact Greek regression that prompted this check", () => {
    const findings = findFabricatedClaims(REAL_REGRESSION, ["Laravel"]);
    expect(findings).toHaveLength(1);
    expect(findings[0].skill).toBe("Laravel");
    expect(findings[0].sentence).toContain("αναπτύσσω");
  });

  it("passes the corrected sentence, which states intent rather than activity", () => {
    expect(findFabricatedClaims(REAL_FIXED, ["Laravel"])).toEqual([]);
  });

  it("catches the English equivalents", () => {
    for (const claim of [
      "I am currently building a Kubernetes operator to close that gap.",
      "I'm learning GraphQL in my own time.",
      "I have used Kubernetes on several projects.",
      "I work with GraphQL daily.",
    ]) {
      expect(findFabricatedClaims(claim, ["Kubernetes", "GraphQL"]).length).toBeGreaterThan(0);
    }
  });

  it("allows naming a gap without claiming it", () => {
    for (const honest of [
      "I have not worked with Kubernetes, though my Docker experience transfers directly.",
      "Kubernetes is the clearest gap; I am keen to pick it up.",
      "While GraphQL is new to me, I have designed REST APIs end to end.",
    ]) {
      expect(findFabricatedClaims(honest, ["Kubernetes", "GraphQL"])).toEqual([]);
    }
  });

  it("does not flag claims about skills the CV actually evidences", () => {
    // Only gap skills are passed in, so a true claim about Docker is untouched.
    const text = "I build Docker images for every service I ship.";
    expect(findFabricatedClaims(text, ["Kubernetes"])).toEqual([]);
  });

  it("does not match a skill name embedded in a longer word", () => {
    const text = "I am building algorithmic trading tools.";
    expect(findFabricatedClaims(text, ["Go"])).toEqual([]);
  });

  it("scopes the claim to the sentence naming the skill", () => {
    // The claim and the gap are in different sentences — not a fabrication.
    const text = "I am building a personal site in React. Kubernetes is a gap for me.";
    expect(findFabricatedClaims(text, ["Kubernetes"])).toEqual([]);
  });

  it("reports every offending skill it finds", () => {
    const text = "I am building a Kubernetes cluster. I work with GraphQL federation too.";
    const findings = findFabricatedClaims(text, ["Kubernetes", "GraphQL"]);
    expect(findings.map((f) => f.skill).sort()).toEqual(["GraphQL", "Kubernetes"]);
  });
});
