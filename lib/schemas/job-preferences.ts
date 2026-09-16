import { z } from "zod";

export const REMOTE_PREFERENCES = ["REMOTE_ONLY", "REMOTE_OK", "ONSITE_OK", "ANY"] as const;
export const SENIORITIES = ["JUNIOR", "MID", "SENIOR"] as const;
export const POSTING_LANGUAGES = ["el", "en"] as const;
export const MAX_TARGET_ROLES = 8;

const chipList = (max: number) =>
  z
    .array(z.string().trim().min(2).max(60))
    .transform((items) => [...new Set(items.map((s) => s.toLowerCase()))].slice(0, max));

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().min(1).max(80).nullable(),
);

/** The profile form. Everything optional but the roles: no roles, no search. */
export const jobPreferencesFormSchema = z.object({
  targetRoles: chipList(MAX_TARGET_ROLES).refine((r) => r.length > 0, {
    message: "Add at least one role to look for",
  }),
  city: optionalText,
  country: optionalText,
  remote: z.enum(REMOTE_PREFERENCES),
  seniority: z.preprocess((v) => (v === "" ? null : v), z.enum(SENIORITIES).nullable()),
  languages: z.array(z.enum(POSTING_LANGUAGES)).min(1, "Pick at least one language"),
  excludeKeywords: chipList(20),
  autoSearch: z.boolean(),
});

export type JobPreferencesInput = z.infer<typeof jobPreferencesFormSchema>;

/**
 * What the model returns when asked to read the CV. Deliberately narrower
 * than the form: it may suggest roles, seniority and where the person is —
 * things a CV says — and nothing about remote preference or exclusions,
 * which a CV does not.
 */
export const preferenceSuggestionSchema = z.object({
  targetRoles: z.array(z.string().min(2).max(60)).min(1).max(MAX_TARGET_ROLES),
  seniority: z.enum(SENIORITIES).nullable(),
  city: z.string().max(80).nullable(),
  country: z.string().max(80).nullable(),
  /** One sentence on why these roles, shown next to the suggestion. */
  rationale: z.string().max(300),
});

export type PreferenceSuggestion = z.infer<typeof preferenceSuggestionSchema>;
