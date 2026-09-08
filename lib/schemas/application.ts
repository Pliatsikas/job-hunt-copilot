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
// "YYYY-MM-DD". Blank must become null rather than undefined: Prisma skips
// undefined fields on update, so an emptied box would silently keep its old
// value instead of clearing.
const blankToNull = (val: unknown) => (val === "" || val == null ? null : val);

const clearableText = () => z.preprocess(blankToNull, z.string().min(1).nullable());
const clearableDate = () => z.preprocess(blankToNull, z.coerce.date().nullable());

export const applicationFormSchema = z.object({
  roleTitle: z.string().min(1, "Role title is required"),
  // Not written to the row directly — resolved into a companyId, where null
  // already means "no company".
  companyName: z.preprocess(blankToNull, z.string().min(1).nullable()),
  jobUrl: z.preprocess(blankToNull, z.url("Enter a valid URL").nullable()),
  jobDescription: z.string().min(1, "Paste the job description"),
  source: clearableText(),
  location: clearableText(),
  workMode: z.enum(WORK_MODES).default("ONSITE"),
  salaryNote: clearableText(),
  status: z.enum(STATUSES).default("SAVED"),
  appliedAt: clearableDate(),
  nextActionAt: clearableDate(),
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
