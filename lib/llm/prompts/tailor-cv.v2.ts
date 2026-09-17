import type { AnalysisResult } from "../../schemas/analysis";
import type { StructuredCv } from "../../schemas/structured-cv";

export const version = "tailor-cv@2";

export type TailorCvV2Input = {
  cv: StructuredCv;
  jobDescription: string;
  roleTitle: string;
  analysis: AnalysisResult;
};

/**
 * Selection by id. The structured CV is printed with every selectable thing
 * tagged `[id]`; the model answers with ids. It has no way to return a
 * sentence, so the grounding question of tailor-cv@1 ("is this line really
 * theirs?") does not arise — the only check left is "does this id exist"
 * (lib/cv/select.ts), plus a few guarantees the owner set: education stays,
 * the current role stays, skills keep their order.
 */
export const system = `You tailor a candidate's CV to one job posting by CHOOSING which of its parts to show, by id.

You cannot write anything. You return ids only:
- keepAbout: whether to show the candidate's own summary paragraph.
- skillGroups: which groups to show, in what order, and which skills to keep in each — by id.
  Keep the skills the posting asks for or values; drop the ones that only add noise for
  this role. Never keep a skill that is not listed.
- experience / education / projects: which entries to show, in what order, and which of
  each entry's bullets to keep — by id. Lead with what this posting cares about. Keep every
  role and every education entry (order them; a missing job reads as a gap). Keep most
  bullets — this must still fill a page: drop a bullet only when it says nothing a
  recruiter for THIS role would want to see, and keep at least two per role where there
  are two. Projects are where to be selective: keep the ones that show the matched skills
  and the posting's keywords, drop the rest.
- certifications: which to keep, by id.
- keywordsAddressed: which of the posting's keywords the kept parts actually contain. Do not
  list a keyword nothing kept contains.

Ids appear in square brackets in the CV below. Use them exactly. An id that does not exist is
discarded. Reply with JSON only, matching the provided schema.`;

export function buildUserPrompt(input: TailorCvV2Input): string {
  const { cv, analysis } = input;
  const entries = (label: string, list: StructuredCv["experience"]) =>
    list.length
      ? [`### ${label}`, ...list.flatMap((e) => [`[${e.id}] ${e.title}${e.org ? ` · ${e.org}` : ""}${e.date ? ` (${e.date})` : ""}`, ...e.bullets.map((b) => `    [${b.id}] ${b.text}`)])]
      : [];
  const doc = [
    `Name: ${cv.name}`,
    cv.about ? `About (keepAbout decides whether it is shown): ${cv.about}` : "About: (none)",
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

  return `## The candidate's CV, with ids
${doc}

## The posting: ${input.roleTitle}
${input.jobDescription}

## From the analysis of this posting against this CV
Matched skills (lead with these): ${matched}
Keywords the posting uses: ${keywords}
Gaps (the CV does not have these — nothing to do about them here): ${gaps}

## Task
Choose what to show and in what order, by id. Return the JSON object.`;
}
