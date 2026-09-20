import { numberedSentences, splitSentences } from "../../cv/sentences";

export const version = "cv-structure@3";

/**
 * Turns an existing CV text — prose, a PDF's lines, whatever the owner has —
 * into the structured shape, written the way a CV reads. This version may
 * write: the owner asked for proper bullets, not sentences cut out of prose.
 * What it may not do is add a fact. Every string is checked afterwards
 * (lib/cv/facts.ts): a number, a proper noun or a technology that the source
 * does not contain drops the string, and the owner sees which token did it.
 */
export const system = `You turn a candidate's CV text into a clean, structured CV. Write it the way a strong CV reads; add nothing that is not in the text.

The one rule: every fact must come from the text. A technology, a company, a school, a date,
a number, a product name, a place — if the text does not contain it, you may not write it.
Strings with a fact that is not in the text are discarded automatically. You may rephrase
freely; you may not invent.

How to write it:
- name; subtitle: a short professional headline (e.g. "Applied Informatics · Fullstack & AI
  Development"), built only from what the text says the person is.
- about: 2–4 sentences, first person, concise. What they do, what they have built, what they
  are looking for — only if the text says so.
- contacts: one per item — phone, email, location, github, website, linkedin, other. value
  as written. href: always "".
- skillGroups: group the skills the text mentions under 3–6 short labels that fit them
  (e.g. "Frontend", "Backend & Databases", "AI & Data", "DevOps & Tools"). One skill per item,
  spelled the standard way ("Next.js", "PostgreSQL"). Only skills the text names.
- languages: name and level as stated. certifications: name, issuer, year as stated.
- experience / education / projects: title, org (company or school; for a project the
  stack, comma-separated), date, location, and the bullets. A bullet: no "I", starts with a
  strong verb ("Designed", "Built", "Deployed"), one line, ≤ 25 words, the result or scope
  first. Each bullet comes from ONE sentence of the text and says what that sentence says —
  put that sentence's number in the bullet's "source" ("S12", or "S12,S13" when it spans
  two). One sentence may become one bullet, or two if it holds two things; a sentence never
  becomes a bullet it does not support. If the text says little about a role, the role gets
  few bullets: do not pad.
  Keep the text's order within each section.
- interests: as listed, one per item. Empty lists where the text has nothing.
- Write in the language the CV text is written in.
- ids: leave every id "". Reply with JSON only, matching the provided schema.`;

export function buildUserPrompt(input: { cvText: string }): string {
  return `## The CV text, one numbered sentence per line (every fact must come from here; cite the numbers)
${numberedSentences(splitSentences(input.cvText))}

## Task
Write the structured CV. Rephrase into proper CV bullets; add no fact. Return the JSON object.`;
}
