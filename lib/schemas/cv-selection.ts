import { z } from "zod";

const id = z.string().min(1).max(40);

/**
 * What the tailoring model returns for a structured CV (tailor-cv@2): ids
 * only. Text cannot appear here, so nothing it says can end up on the page
 * unless the owner wrote it first.
 */
export const cvSelectionSchema = z.object({
  keepAbout: z.boolean(),
  /** Groups in the order to show them; skills to keep in each, by id. */
  skillGroups: z.array(z.object({ id, skills: z.array(id).max(30) })).max(8),
  experience: z.array(z.object({ id, bullets: z.array(id).max(12) })).max(12),
  education: z.array(z.object({ id, bullets: z.array(id).max(12) })).max(8),
  projects: z.array(z.object({ id, bullets: z.array(id).max(12) })).max(12),
  certifications: z.array(id).max(12),
  keywordsAddressed: z.array(z.string().max(80)).max(30),
});

export type CvSelection = z.infer<typeof cvSelectionSchema>;
