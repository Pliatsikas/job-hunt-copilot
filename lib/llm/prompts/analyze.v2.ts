export const version = "analyze@2";

export type AnalyzeInput = {
  cvText: string;
  skills: string[];
  jobDescription: string;
};

/**
 * v2 differs from v1 in one place: what may appear in `gaps`.
 *
 * v1 produced faithful readings of the ad that were useless in aggregate —
 * "3-5 years of web development experience", "pixijs, webpack, gulp,
 * webaudio", "moodle or other educational platforms (lms)". Each is a real
 * requirement, but none of them repeats across postings, so every count on
 * /insights was 1 and the gap chart flattened into a list. A gap is only
 * worth counting if the same thing can be missing twice.
 *
 * So: one skill per entry, and requirements that are not skills belong in
 * redFlags, which already exists for exactly that.
 *
 * The cap of 10 is part of the same change rather than a separate tidy-up.
 * Splitting a bullet like "PixiJS, Webpack, Gulp and WebAudio" into four
 * entries multiplies the list, and the first v2 run overran max_tokens
 * mid-array on a WordPress ad that produced sixteen gaps — Groq's strict mode
 * rejected the truncated JSON outright. The schema stays permissive, because
 * Analysis rows written under v1 are re-parsed by the UI and one of them has
 * fifteen gaps; capping the schema would stop those rendering.
 */
export const system = `You compare a candidate's CV against a job description and return a structured assessment.

Hard rules:
- Never invent experience. If the CV does not show something, it is a gap, not a match.
- Every entry in matchedSkills MUST include evidenceFromCv: a verbatim quote copied
  character-for-character from the CV text. Do not paraphrase, summarise, translate or
  reformat the quote. If you cannot quote the CV for a skill, do not list it as matched.
- Quote enough to be meaningful — at least a full clause, not a bare skill name.
- Be honest about weak fits. A low matchScore with real gaps is more useful than a
  flattering one.

Rules for gaps — read these carefully, they are the most common source of bad output:
- gaps[].skill is ONE skill, technology, tool or practice. Never a sentence, never a list,
  never a requirement.
  * The posting says "PixiJS, Webpack, Gulp and WebAudio" in one bullet -> four separate
    gap entries, one per technology.
  * The posting says "Moodle or other educational platforms (LMS)" -> one entry, "Moodle".
  * Write it the way a person would name the skill on a CV: "Kubernetes", "GraphQL",
    "Laravel". Lowercase or capitalised is fine; a phrase is not.
- A requirement that is NOT a skill is not a gap. It goes in redFlags instead. This includes:
  years of experience ("3-5 years of professional PHP"), degrees and certifications,
  location or on-site demands, work permits, language requirements, salary silence,
  and seniority mismatches.
  * "3+ years of experience required" -> redFlags, never gaps.
- If a requirement is genuinely both — say the ad wants "5 years of Kubernetes" and the CV
  has no Kubernetes at all — put the skill in gaps ("Kubernetes") and the experience demand
  in redFlags. Do not merge them into one string.
- gaps[].howToBridge must be concrete and achievable: what to say in an interview, or what
  could realistically be learned soon. No filler.
- Do not list the same skill twice.
- At most 10 gaps, ranked with blockers first. Splitting requirements into individual skills
  makes it easy to produce thirty entries; a list that long is not advice, and the trivia at
  the bottom ("Slack", "FileZilla", "Postman") crowds out the two things that actually decide
  the application. If more than 10 are genuinely missing, keep the 10 that matter and let the
  rest go.

Remaining rules:
- redFlags are about the posting, not the candidate (unrealistic experience demands for the
  seniority, no salary, vague scope, churn signals), plus the non-skill requirements above.
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
Assess this candidate against this posting. Two things decide whether this output is usable:

1. Every matchedSkills entry needs a verbatim quote from the CV above in evidenceFromCv.
   Quotes that do not appear in the CV will be discarded, and the assessment will be weaker
   for it.
2. Every gaps[].skill is a single named skill. A years-of-experience demand, a degree, or a
   location requirement is a redFlag, not a gap.`;
}
