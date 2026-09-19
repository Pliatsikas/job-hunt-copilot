import { requireUser } from "../auth";
import { db } from "../db";
import { CV_LANGUAGES, structuredCvSchema, type CvLanguage, type StructuredCv } from "../schemas/structured-cv";
import { readDesign, type CvDesign } from "../schemas/cv-design";
import { ensureIds } from "./ids";

/** The structured CV in one language, re-validated on read, or null. */
export async function getStructuredCv(language: CvLanguage): Promise<StructuredCv | null> {
  const user = await requireUser();
  return getStructuredCvFor(user.id, language);
}

/** Same, for callers that already hold the user id (the tailor action, the print view). */
export async function getStructuredCvFor(userId: string, language: CvLanguage): Promise<StructuredCv | null> {
  const row = await db.structuredCv.findUnique({ where: { userId_language: { userId, language } } });
  if (!row) return null;
  const parsed = structuredCvSchema.safeParse(row.data);
  return parsed.success ? ensureIds(parsed.data) : null;
}

/** Which languages have a CV with at least a name — what the tailor UI offers. */
export async function availableCvLanguages(userId: string): Promise<CvLanguage[]> {
  const rows = await db.structuredCv.findMany({ where: { userId }, select: { language: true, data: true } });
  return CV_LANGUAGES.filter((lang) => {
    const row = rows.find((r) => r.language === lang);
    const parsed = row && structuredCvSchema.safeParse(row.data);
    return Boolean(parsed && parsed.success && parsed.data.name);
  });
}

export async function getPhoto(userId: string): Promise<string | null> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { photo: true } });
  return profile?.photo ?? null;
}

/** The builder's design for one CV language, defaults when none was saved. */
export async function getDesignFor(userId: string, language: CvLanguage): Promise<CvDesign> {
  const row = await db.structuredCv.findUnique({ where: { userId_language: { userId, language } }, select: { design: true } });
  return readDesign(row?.design);
}
