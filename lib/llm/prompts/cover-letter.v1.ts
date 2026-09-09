import type { AnalysisResult } from "../../schemas/analysis";
import {
  GROUNDING_RULES,
  LANGUAGE_GUIDANCE,
  LENGTH_GUIDANCE,
  TONE_GUIDANCE,
  topGap,
  type Language,
  type Length,
  type Tone,
} from "./shared";

export const version = "cover-letter@1";

export type CoverLetterInput = {
  cvText: string;
  jobDescription: string;
  roleTitle: string;
  companyName: string | null;
  analysis: AnalysisResult | null;
  language: Language;
  tone: Tone;
  length: Length;
};

export const system = `You write cover letters for a specific candidate applying to a specific job.

${GROUNDING_RULES}
- Address the biggest gap honestly in one sentence rather than hiding it. Name it, then point
  to genuinely transferable experience from the CV. Do not apologise and do not dwell — one
  sentence, then move on.
- The suggested angle for that gap is advice about how to frame it. It is NOT something the
  candidate has done. Never turn it into a claim of current or completed activity: writing
  "I am currently building X" when the CV does not say so is a fabrication, even though it
  sounds modest. Express intent as intent ("keen to", "ready to") or lean on transferable
  work instead.
- Lead with the strongest genuine match, using the evidence supplied. Do not quote the CV
  verbatim at length; write prose.
- Be specific about this company and this role. A letter that would fit any job is a failure.
- No placeholder text. Never emit "[Your Name]", "[Company]" or similar — if you do not know
  something, write around it.`;

export function buildUserPrompt(input: CoverLetterInput): string {
  const gap = input.analysis ? topGap(input.analysis) : null;
  const matched = input.analysis?.matchedSkills ?? [];

  const evidence = matched.length
    ? matched.map((m) => `- ${m.skill}: "${m.evidenceFromCv}"`).join("\n")
    : "(no verified matches — rely on the CV directly and stay conservative)";

  const gapSection = gap
    ? `## The gap to address honestly
${gap.skill} (${gap.severity}).
Framing advice (this is guidance for you, NOT something the candidate has done — do not
restate it as an activity they are engaged in): ${gap.howToBridge}
Address this in exactly one sentence. Do not pretend it isn't there, and do not invent
progress against it.`
    : `## Gaps
No significant gap was identified. Do not invent one to look humble.`;

  return `## Role
${input.roleTitle}${input.companyName ? ` at ${input.companyName}` : ""}

## Job description
${input.jobDescription}

## Candidate CV
${input.cvText}

## Verified matches (each quote was confirmed present in the CV)
${evidence}

${gapSection}

## How to write it
${LANGUAGE_GUIDANCE[input.language]}
Tone: ${TONE_GUIDANCE[input.tone]}
Length: ${LENGTH_GUIDANCE[input.length]}

Write the cover letter now.`;
}
