import { db } from "../db";
import { analysisResultSchema, type AnalysisResult } from "../schemas/analysis";

/**
 * Analysis/Document access lives here rather than in the route, so every query
 * filters by userId AND applicationId (CLAUDE.md rule 1). The ESLint boundary
 * rule enforces it.
 */
export async function getLatestAnalysisResult(
  applicationId: string,
  userId: string,
): Promise<AnalysisResult | null> {
  const latest = await db.analysis.findFirst({
    where: { applicationId, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return null;

  // The column is Json — re-validate rather than trusting what's stored.
  const parsed = analysisResultSchema.safeParse(latest.result);
  return parsed.success ? parsed.data : null;
}

export const DOC_LABEL = {
  COVER_LETTER: "Cover letter",
  FOLLOW_UP_EMAIL: "Follow-up email",
  CV_TAILORED: "Tailored CV",
} as const;

export type SaveDocumentInput = {
  applicationId: string;
  userId: string;
  type: "COVER_LETTER" | "FOLLOW_UP_EMAIL" | "CV_TAILORED";
  /** Follow-ups only — which situation produced this draft. */
  context?: "AFTER_APPLYING" | "AFTER_INTERVIEW" | "NUDGE" | null;
  language: string;
  content: string;
  /** CV_TAILORED from a structured CV: the selected structure, for the designed print view. */
  data?: unknown;
};

/**
 * Appends a new version rather than overwriting, and records the event in the
 * same transaction so history and timeline can't diverge.
 */
export async function saveGeneratedDocument(input: SaveDocumentInput) {
  const previous = await db.document.findFirst({
    where: { applicationId: input.applicationId, userId: input.userId, type: input.type },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = (previous?.version ?? 0) + 1;

  await db.$transaction(async (tx) => {
    await tx.document.create({
      data: {
        applicationId: input.applicationId,
        userId: input.userId,
        type: input.type,
        context: input.context ?? null,
        language: input.language,
        content: input.content,
        data: input.data === undefined ? undefined : (input.data as object),
        version,
      },
    });
    await tx.event.create({
      data: {
        applicationId: input.applicationId,
        userId: input.userId,
        type: "DOCUMENT_CREATED",
        body: `${DOC_LABEL[input.type]} v${version} (${input.language})`,
      },
    });
  });

  return version;
}

/** One tailored CV version, scoped by both ids (CLAUDE.md rule 1). */
export async function getTailoredCv(applicationId: string, userId: string, version: number) {
  if (!Number.isInteger(version) || version < 1) return null;
  return db.document.findFirst({
    where: { applicationId, userId, type: "CV_TAILORED", version },
  });
}
