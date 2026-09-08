import { z } from "zod";

export const CV_TEXT_MIN_USEFUL = 800;

// Blank must become null, not undefined: Prisma skips undefined fields on
// update, so an emptied box would silently keep its old value.
const clearableText = () =>
  z.preprocess((val) => (val === "" || val == null ? null : val), z.string().min(1).nullable());

/**
 * Skills arrive as repeated form fields. Normalizing here rather than in the
 * client is the point — the editor's chips are a convenience, not a guarantee,
 * and M4 matches against these values.
 */
export function normalizeSkills(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : [input];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    // One field may still carry a comma-separated paste.
    for (const part of entry.split(",")) {
      const skill = part.trim().toLowerCase().replace(/\s+/g, " ");
      if (skill) seen.add(skill);
    }
  }

  return [...seen];
}

export const profileFormSchema = z.object({
  headline: clearableText(),
  location: clearableText(),
  yearsOfExp: z.preprocess(
    (val) => (val === "" || val == null ? 0 : val),
    z.coerce.number().int().min(0, "Years can't be negative").max(70),
  ),
  cvText: z.string().min(1, "Paste your CV text — the analysis reads this"),
  skills: z.preprocess(normalizeSkills, z.array(z.string().min(1)).max(100)),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
