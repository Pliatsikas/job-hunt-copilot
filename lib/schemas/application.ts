import { z } from "zod";

export const WORK_MODES = ["REMOTE", "HYBRID", "ONSITE"] as const;

export const STATUSES = [
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;

// Form fields arrive as "" when left blank, and <input type="date"> gives
// "YYYY-MM-DD". Treat blank as absent rather than as an invalid value.
const blankToUndefined = (val: unknown) => (val === "" ? undefined : val);

const optionalText = () => z.preprocess(blankToUndefined, z.string().min(1).optional());
const optionalDate = () => z.preprocess(blankToUndefined, z.coerce.date().optional());

export const applicationFormSchema = z.object({
  roleTitle: z.string().min(1, "Role title is required"),
  companyName: optionalText(),
  jobUrl: z.preprocess(blankToUndefined, z.url("Enter a valid URL").optional()),
  jobDescription: z.string().min(1, "Paste the job description"),
  source: optionalText(),
  location: optionalText(),
  workMode: z.enum(WORK_MODES).default("ONSITE"),
  salaryNote: optionalText(),
  status: z.enum(STATUSES).default("SAVED"),
  appliedAt: optionalDate(),
  nextActionAt: optionalDate(),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

export const SORT_FIELDS = ["created", "applied", "nextAction", "role"] as const;

// Parsed from searchParams, so every field is optional and bad input falls
// back to a default rather than erroring the page.
export const applicationFiltersSchema = z.object({
  status: z.enum(STATUSES).optional().catch(undefined),
  company: z.string().min(1).optional().catch(undefined),
  q: z.string().min(1).optional().catch(undefined),
  sort: z.enum(SORT_FIELDS).default("created").catch("created"),
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
});

export type ApplicationFilters = z.infer<typeof applicationFiltersSchema>;

export const noteSchema = z.object({
  body: z.string().min(1, "Write something first"),
});

export const statusChangeSchema = z.object({
  status: z.enum(STATUSES),
});
