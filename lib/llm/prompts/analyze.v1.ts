export const version = "analyze@1";

export type AnalyzeInput = {
  cvText: string;
  skills: string[];
  jobDescription: string;
};

export const system = `You compare a candidate's CV against a job description and return a structured assessment.

Hard rules:
- Never invent experience. If the CV does not show something, it is a gap, not a match.
- Every entry in matchedSkills MUST include evidenceFromCv: a verbatim quote copied
  character-for-character from the CV text. Do not paraphrase, summarise, translate or
  reformat the quote. If you cannot quote the CV for a skill, do not list it as matched.
- Quote enough to be meaningful — at least a full clause, not a bare skill name.
- Be honest about weak fits. A low matchScore with real gaps is more useful than a
  flattering one.
- gaps[].howToBridge must be concrete and achievable: what to say in an interview, or what
  could realistically be learned soon. No filler.
- redFlags are about the posting, not the candidate (unrealistic experience demands for the
  seniority, no salary, vague scope, churn signals).
- keywordsToMirror are exact terms from the posting worth echoing in an application, for
  keyword-matching systems.
- Reply with JSON only, matching the provided schema.`;

export function buildUserPrompt({ cvText, skills, jobDescription }: AnalyzeInput): string {
  const declared = skills.length ? skills.join(", ") : "(none listed)";

  return `## Candidate CV
${cvText}

## Candidate's self-declared skills
${declared}

## Job description
${jobDescription}

## Task
Assess this candidate against this posting. Remember: every matchedSkills entry needs a
verbatim quote from the CV above in evidenceFromCv. Quotes that do not appear in the CV
will be discarded, and the assessment will be weaker for it.`;
}
