import { z } from "zod";
import { FOLLOW_UP_CONTEXTS } from "../llm/prompts/follow-up.v1";
import { LANGUAGES, LENGTHS, TONES } from "../llm/prompts/shared";

export const DOC_KINDS = ["COVER_LETTER", "FOLLOW_UP_EMAIL"] as const;

export const generateRequestSchema = z
  .object({
    applicationId: z.string().min(1),
    kind: z.enum(DOC_KINDS),
    language: z.enum(LANGUAGES).default("en"),
    tone: z.enum(TONES).default("direct"),
    length: z.enum(LENGTHS).default("standard"),
    context: z.enum(FOLLOW_UP_CONTEXTS).optional(),
  })
  .refine((value) => value.kind !== "FOLLOW_UP_EMAIL" || value.context !== undefined, {
    message: "A follow-up needs a context",
    path: ["context"],
  });

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
