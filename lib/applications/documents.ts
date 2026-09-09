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

export type SaveDocumentInput = {
  applicationId: string;
  userId: string;
  type: "COVER_LETTER" | "FOLLOW_UP_EMAIL";
  language: string;
  content: string;
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
        language: input.language,
        content: input.content,
        version,
      },
    });
    await tx.event.create({
      data: {
        applicationId: input.applicationId,
        userId: input.userId,
        type: "DOCUMENT_CREATED",
        body: `${input.type === "COVER_LETTER" ? "Cover letter" : "Follow-up email"} v${version} (${input.language})`,
      },
    });
  });

  return version;
}
