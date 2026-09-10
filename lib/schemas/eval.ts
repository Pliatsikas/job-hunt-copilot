import { z } from "zod";

/**
 * Eval fixtures are hand-written by a person, so the schema's job is to catch
 * a typo in a file that will otherwise fail deep inside a run that costs real
 * quota. Every message here is written to be read by whoever is editing JSON,
 * not by a stack trace reader.
 */

const skillList = z
  .array(z.string().min(1, "A skill cannot be an empty string"))
  .transform((skills) => skills.map((s) => s.trim().toLowerCase()));

/** Inclusive [min, max]. A range, not a point: scoring is a judgement. */
const scoreRange = z
  .tuple([z.number().int().min(0).max(100), z.number().int().min(0).max(100)])
  .refine(([min, max]) => min <= max, {
    message: "expectedScoreRange must be [min, max] with min <= max",
  });

const baseFixture = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "id must be kebab-case: lowercase letters, digits and hyphens"),
  notes: z.string().min(1, "Say why this case is in the set — a future reader needs it"),
  /**
   * Optional per-fixture CV. Omitted means the shared candidate in
   * evals/fixtures/_candidate.json, which is the normal case: ten ads judged
   * against one real CV is the comparison that matters.
   */
  cvText: z.string().min(1).optional(),
  skills: skillList.optional(),
});

export const analysisFixtureSchema = baseFixture.extend({
  kind: z.literal("analysis"),
  roleTitle: z.string().min(1),
  companyName: z.string().min(1).nullable().default(null),
  source: z.string().min(1).nullable().default(null),
  language: z.enum(["en", "el"]),
  jobDescription: z.string().min(120, "Paste the whole ad — a summary evaluates the summary"),
  expectedScoreRange: scoreRange,
  /** Skills the analysis must find in the CV. Drives the recall metric. */
  mustFindSkills: skillList,
  /** Skills the posting demands that the CV cannot answer. Optional. */
  mustFlagGaps: skillList.default([]),
});

export const coverLetterFixtureSchema = baseFixture.extend({
  kind: z.literal("cover_letter"),
  roleTitle: z.string().min(1),
  companyName: z.string().min(1).nullable().default(null),
  language: z.enum(["en", "el"]),
  jobDescription: z.string().min(1),
  /** The analysis the letter is grounded in, supplied rather than generated. */
  analysis: z.unknown(),
  /** Skills absent from the CV — the fabrication detector's input. */
  absentSkills: z.array(z.string().min(1)),
  assertions: z
    .object({
      automated: z.array(z.string()).default([]),
      manualReview: z.array(z.string()).default([]),
    })
    .default({ automated: [], manualReview: [] }),
  languages: z.array(z.enum(["en", "el"])).default(["en"]),
  milestone: z.string().optional(),
  why: z.string().optional(),
});

export const evalFixtureSchema = z.discriminatedUnion("kind", [
  analysisFixtureSchema,
  coverLetterFixtureSchema,
]);

/** The one CV every analysis fixture is judged against unless it overrides it. */
export const candidateSchema = z.object({
  label: z.string().min(1),
  cvText: z.string().min(1),
  skills: skillList,
});

export type AnalysisFixture = z.infer<typeof analysisFixtureSchema>;
export type CoverLetterFixture = z.infer<typeof coverLetterFixtureSchema>;
export type EvalFixture = z.infer<typeof evalFixtureSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
