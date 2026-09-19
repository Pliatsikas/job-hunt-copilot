import { z } from "zod";

/**
 * The builder's design choices (T10), saved per CV language. A closed set on
 * purpose: a template is a component, an accent is one of eight colours that
 * are known to read on every template's background, and the photo is a
 * switch. Nothing here can make a CV that does not print.
 */
export const CV_TEMPLATES = ["sidebar", "classic", "modern", "minimal"] as const;
export type CvTemplate = (typeof CV_TEMPLATES)[number];

export const CV_ACCENTS = {
  clay: "#c9a99a",
  navy: "#2f52d8",
  forest: "#2f7d5b",
  wine: "#8b2942",
  slate: "#4b5563",
  teal: "#0f766e",
  amber: "#b45309",
  black: "#1c1f26",
} as const;
export type CvAccent = keyof typeof CV_ACCENTS;

export const cvDesignSchema = z.object({
  template: z.enum(CV_TEMPLATES),
  accent: z.enum(Object.keys(CV_ACCENTS) as [CvAccent, ...CvAccent[]]),
  showPhoto: z.boolean(),
});
export type CvDesign = z.infer<typeof cvDesignSchema>;

export const DEFAULT_DESIGN: CvDesign = { template: "sidebar", accent: "clay", showPhoto: true };

/** Reads a stored design, falling back to the defaults for anything missing or stale. */
export function readDesign(value: unknown): CvDesign {
  const parsed = cvDesignSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_DESIGN;
}

/** Which templates have a place for a photo at all. */
export const TEMPLATE_HAS_PHOTO: Record<CvTemplate, boolean> = {
  sidebar: true,
  classic: true,
  modern: true,
  minimal: false,
};
