import { z } from "zod";

export const LEAD_SOURCES = ["GREENHOUSE", "LEVER", "ARBEITNOW", "REMOTIVE"] as const;

export const savedSearchSchema = z.object({
  name: z.string().trim().min(1, "Give the search a name").max(80),
  source: z.enum(LEAD_SOURCES),
  query: z
    .string()
    .trim()
    .min(2, "A slug or search term, at least two characters")
    .max(80)
    .regex(/^[\p{L}\p{N} ._-]+$/u, "Letters, digits, spaces, dots, dashes and underscores only"),
});

export type SavedSearchInput = z.infer<typeof savedSearchSchema>;
