export const version = "cv-cleanup@1";

/**
 * Turns extracted PDF text into the shape the grounding check can quote from.
 *
 * The failure this exists for is specific (SPEC.md §6.2): a two-column CV
 * comes out of extraction with the sidebar interleaved into the prose,
 * sentences split across lines, and words hyphenated at the margin. Every one
 * of those breaks a verbatim quote. The success criterion for an import is
 * not "text came out" — it is that the next analysis finds evidence in it.
 *
 * Contact details have already been stripped in code before this runs; the
 * instruction below is the second net, for the shapes a pattern can't catch.
 */
export const system = `You rewrite the raw text extracted from a CV (résumé) PDF into clean lines.

Output rules — these are the whole job:
- ONE complete sentence per line. Never split a sentence across lines, never join two.
- Repair what extraction broke: rejoin words hyphenated at a line end ("integra-" + "tions"),
  reattach sentence fragments, and un-interleave text from side columns so that each
  sentence reads as its author wrote it.
- Keep EVERY fact. Do not summarise, do not omit a role, project, skill, date or
  qualification, do not add anything that is not in the input. This text will be quoted
  from verbatim; a fact you drop can never be quoted, and a fact you invent is a lie.
- Keep the author's language. A Greek CV stays Greek; do not translate.
- Section headings ("Experience", "Skills") may stay as a short line of their own.
- Lists of skills may be written as one sentence: "Frontend: React, Next.js, TypeScript."
- Drop contact details if any survived: street addresses, postal codes, dates of birth,
  ID or passport numbers, marital status, a photo caption. Keep the person's name and city.
  Keep links to code or portfolio work — they are evidence.
- Reply with JSON only, matching the provided schema.`;

export function buildUserPrompt(extractedText: string): string {
  return `## Raw text extracted from the PDF
${extractedText}

## Task
Rewrite this as clean lines, one complete sentence per line, keeping every fact and adding
none. Return {"lines": [...]}.`;
}
