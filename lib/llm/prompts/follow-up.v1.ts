import {
  GROUNDING_RULES,
  LANGUAGE_GUIDANCE,
  TONE_GUIDANCE,
  type Language,
  type Tone,
} from "./shared";

export const version = "follow-up@1";

export const FOLLOW_UP_CONTEXTS = ["after_applying", "after_interview", "nudge"] as const;
export type FollowUpContext = (typeof FOLLOW_UP_CONTEXTS)[number];

/** Wire value -> Prisma enum. Kept here so the mapping lives with the values. */
export const CONTEXT_TO_DB: Record<FollowUpContext, "AFTER_APPLYING" | "AFTER_INTERVIEW" | "NUDGE"> = {
  after_applying: "AFTER_APPLYING",
  after_interview: "AFTER_INTERVIEW",
  nudge: "NUDGE",
};

export const DB_TO_CONTEXT_LABEL: Record<"AFTER_APPLYING" | "AFTER_INTERVIEW" | "NUDGE", string> = {
  AFTER_APPLYING: "after applying",
  AFTER_INTERVIEW: "after interview",
  NUDGE: "ten-day nudge",
};

export const CONTEXT_LABELS: Record<FollowUpContext, string> = {
  after_applying: "After applying",
  after_interview: "After an interview",
  nudge: "Ten-day nudge",
};

const CONTEXT_GUIDANCE: Record<FollowUpContext, string> = {
  after_applying: `The candidate applied recently and has had no reply yet. Confirm continued
interest, add one concrete detail that strengthens the application, and make it easy to
respond. Do not ask for a decision — it is too early.`,

  after_interview: `The candidate has interviewed. Thank them for their time, refer to
something specific that could plausibly have come up given this role, reinforce one relevant
strength, and state continued interest. Do not invent details of what was discussed — keep any
reference general enough to be true.`,

  nudge: `Roughly ten days have passed with no response. Be brief and gracious. Ask politely
about the timeline, restate interest in one line, and give them an easy exit if the role is
filled. Do not express frustration or imply neglect.`,
};

export type FollowUpInput = {
  cvText: string;
  jobDescription: string;
  roleTitle: string;
  companyName: string | null;
  context: FollowUpContext;
  language: Language;
  tone: Tone;
};

export const system = `You write short follow-up emails for a candidate about a job application.

${GROUNDING_RULES}
- Keep it under 120 words. These are read on a phone, in a hurry.
- Start with a "Subject:" line, then a blank line, then the body.
- Do not invent what was said in an interview, who the candidate spoke to, or any date.
- No guilt-tripping and no pressure. The recipient does not owe a reply.
- No placeholder text — never "[Recruiter Name]" or similar.`;

export function buildUserPrompt(input: FollowUpInput): string {
  return `## Role
${input.roleTitle}${input.companyName ? ` at ${input.companyName}` : ""}

## Job description
${input.jobDescription}

## Candidate CV
${input.cvText}

## Situation
${CONTEXT_GUIDANCE[input.context]}

## How to write it
${LANGUAGE_GUIDANCE[input.language]}
Tone: ${TONE_GUIDANCE[input.tone]}

Write the email now.`;
}
