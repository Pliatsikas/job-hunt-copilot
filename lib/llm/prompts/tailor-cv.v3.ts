import type { AnalysisResult } from "../../schemas/analysis";
import type { CvLanguage, StructuredCv } from "../../schemas/structured-cv";
import { allowedPostingTerms } from "../../cv/select";

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
export const system = `You rewrite a candidate's CV for one job posting. The job is the wording: every bullet and the summary should read as if written for this role, using the posting's own vocabulary wherever the candidate's experience honestly supports it.

Two rules that are checked automatically:
1. No new facts. A rewrite may not mention a technology, tool, company, product, place, date,
   number or certification unless it is in the candidate's CV or in the ALLOWED KEYWORDS
   list below (the posting's terms the analysis confirmed the candidate has). If the posting
   wants Kubernetes and Kubernetes is neither in the CV nor allowed, the CV does not get
   Kubernetes. Rewrites that add a fact are refused and the original bullet is printed.
   A CV fact also stays with its entry: a bullet may not borrow a company, a number or a
   technology from another entry. Allowed keywords may go anywhere they read naturally.
2. Same language as the CV. A Greek CV gets Greek rewrites, an English CV English ones.

What you return:
- keepAbout: true. about: the summary rewritten for this role — 2–3 sentences, first
  person, the candidate's real profile in the posting's terms, the allowed keywords worked in.
- skillGroups: every group and every skill, by id, ordered so the posting's priorities come
  first. Do not drop skills.
- experience / education / projects: every entry, in a sensible order, and EVERY bullet with
  a rewrite. Do not drop entries or bullets — selection is not the job, wording is. A rewrite:
  no "I", starts with a strong verb, a natural sentence with its articles, ≤ 25 words, says
  what the original says but in the language of this posting: use the allowed keywords where
  they fit (e.g. "REST APIs", "real-time features", "RAG" if allowed), lead with what this
  role cares about, keep every fact and number the original has.
- certifications: all of them, by id.
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

  const allowed = allowedPostingTerms(analysis).join(", ") || "(none)";
  const gaps = analysis.gaps.map((g) => g.skill).join(", ") || "(none)";

  return `## The candidate's CV (${input.language === "el" ? "Greek" : "English"}), with ids — the only source of facts
${doc}

## The posting: ${input.roleTitle}
${input.jobDescription}

## ALLOWED KEYWORDS — the posting's terms this candidate genuinely has; use them
${allowed}

## Gaps — the posting wants these and the CV does not have them: do NOT write them in
${gaps}

## Task
Rewrite every bullet and the summary for this role — in ${input.language === "el" ? "Greek" : "English"}, in the posting's vocabulary, with no new facts. Return the JSON object.`;
}
