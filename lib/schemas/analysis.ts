import { z } from "zod";

export const VERDICTS = ["strong_fit", "worth_applying", "stretch", "skip"] as const;
export const SEVERITIES = ["blocker", "important", "nice_to_have"] as const;

/**
 * SPEC.md §3.3. This is the single source of truth: the prompt's JSON schema
 * is generated from it, the response is parsed against it, and the TS types
 * come from z.infer — never hand-written alongside.
 */
export const analysisResultSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  verdict: z.enum(VERDICTS),
  summary: z.string().max(500),
  matchedSkills: z.array(
    z.object({
      skill: z.string(),
      // Must be a verbatim quote from the CV. Enforced after parsing by the
      // grounding check, not by the schema — a fabricated quote is still a
      // well-formed string.
      evidenceFromCv: z.string(),
    }),
  ),
  gaps: z.array(
    z.object({
      skill: z.string(),
      severity: z.enum(SEVERITIES),
      howToBridge: z.string(),
    }),
  ),
  keywordsToMirror: z.array(z.string()).max(15),
  redFlags: z.array(z.string()),
  likelyQuestions: z.array(z.string()).max(8),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type MatchedSkill = AnalysisResult["matchedSkills"][number];
export type Gap = AnalysisResult["gaps"][number];
export type Verdict = AnalysisResult["verdict"];
export type Severity = Gap["severity"];
