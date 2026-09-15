import type { AnalysisResult } from "../../schemas/analysis";
import { CV_SECTIONS } from "../../schemas/tailored-cv";

export const version = "tailor-cv@1";

export type TailorCvInput = {
  cvLines: string[];
  jobDescription: string;
  roleTitle: string;
  analysis: AnalysisResult;
};

/**
 * A CV reads as fact, where a cover letter reads as argument (SPEC.md §6.3).
 * An inflated cover letter is bad style; an inflated CV is a lie on a formal
 * document that the interview will expose. So the model's only power here is
 * to choose which of the candidate's own lines to show and in what order.
 * It may not rephrase, and the owner has asked for that explicitly: their
 * words, as they wrote them.
 *
 * Enforcement does not rest on the prompt. Every output line is matched
 * against the CV's lines exactly; anything that differs by a character is
 * discarded and counted (lib/llm/tailor-grounding.ts).
 */
export const system = `You tailor a candidate's CV to one job posting by SELECTING and ORDERING lines from it.

The one rule that matters:
- Every line you output MUST be copied character-for-character from the numbered CV lines
  you are given. Do not rephrase, shorten, merge, split, translate, fix typos, or change a
  single character. Lines that are not exact copies will be discarded automatically, and a
  CV with discarded lines is worse than one you didn't tailor.
- You may NOT add anything: no new skill, no new role, no new date, no summary sentence of
  your own. If it is not in the CV, it does not exist.

How to tailor, within that rule:
- Put first what this posting cares about. Use the analysis: the matched skills are what to
  lead with, the keywords to mirror are what a screening system will search for, so the
  lines that contain them belong near the top of their section.
- Reorder projects and roles by relevance to this posting, not by date.
- You may leave out lines that are irrelevant to this role — a game-development project on
  a backend application, say — but never leave out the candidate's name and city, their
  education, or their current role.
- Keep section headings to the fixed set: ${CV_SECTIONS.join(", ")}. Put each line under
  the heading it belongs to in the original CV. Do not create a section the CV lacks.
- Do not repeat a line.
- keywordsAddressed: which of the posting's keywords the chosen lines actually contain. Do
  not list a keyword no chosen line contains.
- Reply with JSON only, matching the provided schema.`;

export function buildUserPrompt(input: TailorCvInput): string {
  const numbered = input.cvLines.map((line, i) => `${String(i + 1).padStart(3, " ")}| ${line}`);
  const matched = input.analysis.matchedSkills.map((m) => m.skill).join(", ") || "(none)";
  const keywords = input.analysis.keywordsToMirror.join(", ") || "(none)";
  const gaps = input.analysis.gaps.map((g) => g.skill).join(", ") || "(none)";

  return `## The candidate's CV, one line per row (copy lines EXACTLY, without the number)
${numbered.join("\n")}

## The posting: ${input.roleTitle}
${input.jobDescription}

## From the analysis of this posting against this CV
Matched skills (lead with these): ${matched}
Keywords the posting uses (a screening system will look for these): ${keywords}
Gaps (the CV does not have these — you cannot add them, do not try): ${gaps}

## Task
Select and order the CV's lines for this posting. Every line character-for-character from the
rows above. Return {"sections": [...], "keywordsAddressed": [...]}.`;
}
