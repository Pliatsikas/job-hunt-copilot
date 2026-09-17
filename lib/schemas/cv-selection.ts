import { z } from "zod";

const id = z.string().min(1).max(40);
/** "" keeps the owner's original text; anything else is the model's rewrite, checked before use. */
const rewrite = z.string().max(400);

/**
 * What the tailoring model returns (tailor-cv@3): ids of what to keep, in
 * what order, and — new in @3 — an optional rewrite per bullet and for the
 * about paragraph, aimed at the posting. A rewrite is used only if every
 * fact in it is in the owner's CV and it is in the CV's language
 * (lib/cv/select.ts); otherwise the original stands and the rejection is
 * recorded. All fields are required: Groq's strict schema mode has no
 * optionals, so "" is the "no rewrite" value.
 */
export const cvSelectionSchema = z.object({
  keepAbout: z.boolean(),
  about: rewrite,
  /** Groups in the order to show them; skills to keep in each, by id. */
  skillGroups: z.array(z.object({ id, skills: z.array(id).max(30) })).max(8),
  experience: z.array(z.object({ id, bullets: z.array(z.object({ id, text: rewrite })).max(12) })).max(12),
  education: z.array(z.object({ id, bullets: z.array(z.object({ id, text: rewrite })).max(12) })).max(8),
  projects: z.array(z.object({ id, bullets: z.array(z.object({ id, text: rewrite })).max(12) })).max(12),
  certifications: z.array(id).max(12),
  keywordsAddressed: z.array(z.string().max(80)).max(30),
});

export type CvSelection = z.infer<typeof cvSelectionSchema>;
