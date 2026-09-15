import { z } from "zod";

/** 2 MB is generous for a CV; Vercel's request body limit is 4.5 MB. */
export const CV_PDF_MAX_BYTES = 2 * 1024 * 1024;

/**
 * What the cleanup pass returns. Lines, not a blob: "one sentence per line"
 * is the entire point of the pass, and asking for an array makes the shape
 * something the schema can check rather than something to hope for.
 */
export const cvCleanupSchema = z.object({
  lines: z
    .array(z.string().min(1))
    .min(5, "A CV with fewer than five lines is not a CV")
    .max(400),
});

export type CvCleanup = z.infer<typeof cvCleanupSchema>;

/** The review screen's save action takes the text the user has looked at. */
export const applyImportedCvSchema = z.object({
  cvText: z.string().min(200, "Too short to be a CV — import produced almost nothing"),
});
