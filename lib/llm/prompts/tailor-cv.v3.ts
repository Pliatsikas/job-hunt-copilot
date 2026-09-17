import type { AnalysisResult } from "../../schemas/analysis";
import type { CvLanguage, StructuredCv } from "../../schemas/structured-cv";

export const version = "tailor-cv@3";

export type TailorCvV3Input = {
  cv: StructuredCv;
  language: CvLanguage;
  jobDescription: string;
  roleTitle: string;
  analysis: AnalysisResult;
};

/**
 * Selection by id, plus rewrites. The owner asked (2026-09-17) for a CV
 * that is actually reworked for the posting, not just reordered — so the
 * model may now rephrase the kept bullets and the about paragraph toward
 * the posting's vocabulary. The line it may not cross is a fact: every
 * technology, company, number or product in a rewrite must already be in
 * the owner's CV, or the rewrite is refused and the original stands
 * (lib/cv/facts.ts, lib/cv/select.ts). The owner sees every change.
 */
export const system = `You tailor a candidate's CV to one job posting. You choose what to show, by id, and you may rephrase the kept text so it speaks the posting's language.

Two rules that are checked automatically:
1. No new facts. A rewrite may not mention a technology, tool, company, product, place, date,
   number or certification that the candidate's CV does not contain. If the posting wants
   Kubernetes and the CV never says Kubernetes, the CV does not get Kubernetes. Rewrites that
   add a fact are refused and the original bullet is printed instead.
   A fact also stays with its entry: a rewrite of a bullet may only name technologies,
   products and places that entry already names. The SaaS project's Node.js does not move
   to the desktop app's bullet.
2. Same language as the CV. A Greek CV gets Greek rewrites, an English CV English ones.

What you return:
- keepAbout and about: whether to show the summary, and a rewrite of it aimed at this role
  (2–3 sentences, first person, the candidate's real profile in the posting's terms), or ""
  to keep the original.
- skillGroups: which groups, in what order, which skills in each — by id. Lead with what the
  posting asks for. Never add a skill that is not listed.
- experience / education / projects: which entries in what order, and for each kept bullet
  its id and either a rewrite or "". Keep every role and every education entry. Keep most
  bullets — the CV must still fill a page; drop only what says nothing to this role. Projects
  are where to be selective. A rewrite: no "I", starts with a verb, a natural sentence with
  its articles (25 words is a ceiling, not a target), mirrors the posting's wording where it
  is truthful ("REST APIs" if the posting says REST APIs and the CV built REST APIs), leads
  with what this role cares about. Rewrite only where it helps; "" keeps a bullet as it is.
- certifications: which to keep, by id.
- keywordsAddressed: which of the posting's keywords the final text actually contains.

Ids appear in square brackets in the CV. Use them exactly; unknown ids are discarded. Reply
with JSON only, matching the provided schema.`;

export function buildUserPrompt(input: TailorCvV3Input): string {
  const { cv, analysis } = input;
  const entries = (label: string, list: StructuredCv["experience"]) =>
    list.length
      ? [`### ${label}`, ...list.flatMap((e) => [`[${e.id}] ${e.title}${e.org ? ` · ${e.org}` : ""}${e.date ? ` (${e.date})` : ""}`, ...e.bullets.map((b) => `    [${b.id}] ${b.text}`)])]
      : [];
  const doc = [
    `Name: ${cv.name}`,
    cv.about ? `About: ${cv.about}` : "About: (none)",
    "### Skills",
    ...cv.skillGroups.map((g) => `[${g.id}] ${g.label}: ${g.skills.map((s) => `[${s.id}] ${s.name}`).join(", ")}`),
    ...entries("Experience (most recent first)", cv.experience),
    ...entries("Education", cv.education),
    ...entries("Projects", cv.projects),
    "### Certifications",
    ...cv.certifications.map((c) => `[${c.id}] ${c.name}${c.issuer ? ` — ${c.issuer}` : ""}`),
  ].join("\n");

  const matched = analysis.matchedSkills.map((m) => m.skill).join(", ") || "(none)";
  const keywords = analysis.keywordsToMirror.join(", ") || "(none)";
  const gaps = analysis.gaps.map((g) => g.skill).join(", ") || "(none)";

  return `## The candidate's CV (${input.language === "el" ? "Greek" : "English"}), with ids — the only source of facts
${doc}

## The posting: ${input.roleTitle}
${input.jobDescription}

## From the analysis of this posting against this CV
Matched skills (lead with these): ${matched}
Keywords the posting uses (mirror them where the CV honestly supports them): ${keywords}
Gaps (the CV does not have these — do NOT write them in): ${gaps}

## Task
Choose what to show, order it, and rephrase the kept text for this role — in ${input.language === "el" ? "Greek" : "English"}, with no new facts. Return the JSON object.`;
}
