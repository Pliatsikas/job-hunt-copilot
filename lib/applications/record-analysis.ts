import type { RunAnalysisOutput } from "../analysis/run";
import { db } from "../db";

/**
 * The one place an analysis is written. The Analysis row, its event and the
 * denormalized fields on Application land in one transaction —
 * Application.latestMatchScore has exactly one writer and this is it
 * (CLAUDE.md rule 8 / SPEC.md §8 Α2). The analyze action and the first-run
 * guide both call this rather than each carrying a copy of the transaction.
 */
export async function recordAnalysis(applicationId: string, userId: string, run: RunAnalysisOutput): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.analysis.create({
      data: {
        applicationId,
        userId,
        provider: run.provider,
        model: run.model,
        promptVersion: run.promptVersion,
        matchScore: run.result.matchScore,
        result: run.result,
        droppedClaims: run.droppedClaims,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        latencyMs: run.latencyMs,
      },
    });
    await tx.event.create({
      data: {
        applicationId,
        userId,
        type: "ANALYSIS_RUN",
        body: `Match score ${run.result.matchScore} · ${run.provider}/${run.model}`,
      },
    });
    await tx.application.update({
      where: { id: applicationId },
      data: { latestMatchScore: run.result.matchScore, lastAnalyzedAt: new Date() },
    });
  });
}
