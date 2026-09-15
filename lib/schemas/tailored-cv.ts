import { z } from "zod";

/**
 * Fixed headings, so the model cannot invent a section — "Leadership" on a
 * CV that has no such section is a claim, not a heading.
 */
export const CV_SECTIONS = [
  "PROFILE",
  "EXPERIENCE",
  "PROJECTS",
  "SKILLS",
  "EDUCATION",
  "LANGUAGES",
  "CERTIFICATIONS",
  "OTHER",
] as const;

export type CvSection = (typeof CV_SECTIONS)[number];

/**
 * The tailored CV is a selection and an ordering of the CV's own lines —
 * nothing else. Every `lines[]` entry must reproduce one line of `cvText`
 * character for character; the grounding pass rejects anything that does
 * not. So the schema describes structure only; the content is the user's.
 */
export const tailoredCvSchema = z.object({
  sections: z
    .array(
      z.object({
        heading: z.enum(CV_SECTIONS),
        lines: z.array(z.string().min(1)).min(1).max(40),
      }),
    )
    .min(2)
    .max(8),
  /** Keywords from the posting the ordering was built around — for the UI. */
  keywordsAddressed: z.array(z.string()).max(15),
});

export type TailoredCv = z.infer<typeof tailoredCvSchema>;
