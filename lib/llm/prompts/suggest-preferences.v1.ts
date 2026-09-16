export const version = "suggest-preferences@1";

/**
 * Reads a CV and proposes what to search for. The output is a proposal the
 * owner edits before anything is saved — it fills a form, it does not set a
 * record — so the bar is "useful starting point", not "correct". It is still
 * grounded: a role the CV gives no evidence for is an invention, and the
 * prompt says so.
 */
export const system = `You read a candidate's CV and propose what job titles they should search for.

Rules:
- targetRoles: 3 to 6 job titles as they appear on job boards, most likely first. Each one must
  be supported by the CV — the technologies, the projects, the roles held. "Fullstack
  developer" for someone shipping React and Node is supported; "engineering manager" for
  someone with no leadership is not. Use the language job boards use in the candidate's
  market: for a Greek candidate that is mostly English titles ("frontend developer"), with a
  Greek one only if the CV itself is in Greek.
- Include one adjacent title that the CV supports but the candidate may not have thought
  of, if there is one. Do not include titles the CV cannot back.
- seniority: JUNIOR, MID or SENIOR from years and scope of work, or null if you cannot tell.
  A student or someone with under two years is JUNIOR.
- city and country: where the candidate is based, from the CV, or null. Do not guess.
- rationale: one sentence on why these roles, in the same language as the CV.
- Reply with JSON only, matching the provided schema.`;

export function buildUserPrompt(input: { cvText: string; skills: string[] }): string {
  const declared = input.skills.length ? input.skills.join(", ") : "(none listed)";
  return `## Candidate CV
${input.cvText}

## Candidate's self-declared skills
${declared}

## Task
Propose the job titles this candidate should search for, their seniority, and where they are
based. Return {"targetRoles": [...], "seniority": ..., "city": ..., "country": ..., "rationale": "..."}.`;
}
