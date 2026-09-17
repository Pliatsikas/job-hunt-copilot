import { z } from "zod";

/**
 * The structured CV (T09): what the designed document is built from. One per
 * language. Every leaf that can be selected by the tailoring model carries an
 * id, so the model's output is a list of ids and never a line of text.
 */
export const CV_LANGUAGES = ["en", "el"] as const;
export type CvLanguage = (typeof CV_LANGUAGES)[number];

const short = z.string().trim().max(120);
const line = z.string().trim().max(600);
// May be empty on the way in (the extraction leaves ids blank); ensureIds() fills them.
const id = z.string().trim().max(40);

export const contactSchema = z.object({
  id,
  /** phone | email | location | github | website | linkedin | other — drives the icon. */
  kind: z.enum(["phone", "email", "location", "github", "website", "linkedin", "other"]),
  value: short.min(1),
  /** "" prints the value as text. Required (not optional) because Groq's
   *  strict JSON-schema mode refuses optional properties. */
  href: z.string().trim().max(300),
});

export const skillGroupSchema = z.object({
  id,
  label: short.min(1),
  skills: z.array(z.object({ id, name: short.min(1) })).max(30),
});

export const languageSchema = z.object({ id, name: short.min(1), level: short });
export const certificationSchema = z.object({ id, name: short.min(1), issuer: short, year: short });

export const bulletSchema = z.object({ id, text: line.min(1) });

/** One dated entry: a role, a degree, a project. The same shape for all three. */
export const entrySchema = z.object({
  id,
  title: short.min(1),
  /** Company, school, or the project's stack line. */
  org: short,
  date: short,
  location: short,
  bullets: z.array(bulletSchema).max(12),
  /** Projects only: live / repo links, printed under the bullets. */
  links: z.array(z.object({ id, label: short.min(1), href: z.string().trim().max(300) })).max(4),
});

export const structuredCvSchema = z.object({
  name: short.min(1),
  /** The line under the name: "Applied Informatics · Fullstack & AI Development". */
  subtitle: short,
  about: z.string().trim().max(1200),
  contacts: z.array(contactSchema).max(8),
  skillGroups: z.array(skillGroupSchema).max(8),
  languages: z.array(languageSchema).max(8),
  certifications: z.array(certificationSchema).max(12),
  interests: z.array(z.object({ id, name: short.min(1) })).max(12),
  experience: z.array(entrySchema).max(12),
  education: z.array(entrySchema).max(8),
  projects: z.array(entrySchema).max(12),
});

export type StructuredCv = z.infer<typeof structuredCvSchema>;
export type CvEntry = z.infer<typeof entrySchema>;
export type CvContact = z.infer<typeof contactSchema>;

export const EMPTY_CV: StructuredCv = {
  name: "",
  subtitle: "",
  about: "",
  contacts: [],
  skillGroups: [],
  languages: [],
  certifications: [],
  interests: [],
  experience: [],
  education: [],
  projects: [],
};

/** Section labels in the CV's own language — the document reads as one thing. */
export const CV_LABELS: Record<CvLanguage, Record<string, string>> = {
  en: {
    contact: "Contact",
    skills: "Skills",
    languages: "Languages",
    certifications: "Certifications",
    interests: "Interests",
    experience: "Work Experience",
    education: "Education",
    projects: "Projects",
  },
  el: {
    contact: "Επικοινωνία",
    skills: "Δεξιότητες",
    languages: "Γλώσσες",
    certifications: "Πιστοποιητικά",
    interests: "Ενδιαφέροντα",
    experience: "Επαγγελματική Εμπειρία",
    education: "Εκπαίδευση",
    projects: "Έργα",
  },
};

/** Photo: a data URL, JPEG or PNG or WebP, at most 300 KB of base64. */
export const PHOTO_MAX_CHARS = 300 * 1024;
export const photoSchema = z
  .string()
  .max(PHOTO_MAX_CHARS, "The photo is too large — it should be under 300 KB after resizing.")
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Not an image the CV can use.");

/**
 * What the extraction model returns: the structured CV, plus for every bullet
 * a reference to the numbered sentence(s) of the CV text it was written from
 * ("S12" or "S12,S13"). The grounding resolves the reference and checks the
 * bullet really says what those sentences say; then the field is dropped and
 * the CV saved without it. Not optional (Groq strict mode); "" fails the
 * check on purpose.
 */
const extractedBullet = z.object({ id, text: line.min(1), source: z.string().trim().max(20) });
const extractedEntry = entrySchema.extend({ bullets: z.array(extractedBullet).max(12) });
export const extractedCvSchema = structuredCvSchema.extend({
  experience: z.array(extractedEntry).max(12),
  education: z.array(extractedEntry).max(8),
  projects: z.array(extractedEntry).max(12),
});
export type ExtractedCv = z.infer<typeof extractedCvSchema>;
