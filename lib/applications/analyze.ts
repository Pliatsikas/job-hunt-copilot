"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getProvider } from "../llm";
import { groundAnalysis } from "../llm/grounding";
import * as analyzePrompt from "../llm/prompts/analyze.v1";
import { AnalysisError, completeWithRepair } from "../llm/repair";
import { assertUnderDailyLimit, recordProviderCall } from "../llm/usage";
import { getProfile } from "../profile/get";
import { analysisResultSchema } from "../schemas/analysis";
import { requireOwnedApplication } from "./guards";

export type AnalyzeState = { error?: string; ranAt?: number };

const ANALYSIS_TEMPERATURE = 0.2;
const ANALYSIS_MAX_TOKENS = 4096;

export async function analyzeApplication(
  applicationId: string,
  _prevState: AnalyzeState,
  _formData: FormData,
): Promise<AnalyzeState> {
  try {
    const application = await requireOwnedApplication(applicationId);

    const profile = await getProfile();
    if (!profile?.cvText.trim()) {
      return {
        error: "Add your CV text on the profile page first — there's nothing to compare against.",
      };
    }

    await assertUnderDailyLimit(application.userId);

    const provider = getProvider();

    const completion = await completeWithRepair(
      provider,
      {
        system: analyzePrompt.system,
        user: analyzePrompt.buildUserPrompt({
          cvText: profile.cvText,
          skills: profile.skills,
          jobDescription: application.jobDescription,
        }),
        temperature: ANALYSIS_TEMPERATURE,
        maxTokens: ANALYSIS_MAX_TOKENS,
      },
      analysisResultSchema,
      () => recordProviderCall(application.userId),
    );

    // Grounding runs after a successful parse and never triggers a repair.
    const { result, droppedClaims } = groundAnalysis(completion.data, profile.cvText);

    // The Analysis row, its event, and the denormalized fields on Application
    // land together — Application.latestMatchScore has exactly one writer and
    // this is it (CLAUDE.md rule 8 / SPEC.md §8 Α2).
    await db.$transaction(async (tx) => {
      await tx.analysis.create({
        data: {
          applicationId: application.id,
          userId: application.userId,
          provider: provider.name,
          model: provider.model,
          promptVersion: analyzePrompt.version,
          matchScore: result.matchScore,
          result,
          droppedClaims,
          inputTokens: completion.usage.inputTokens,
          outputTokens: completion.usage.outputTokens,
          latencyMs: completion.latencyMs,
        },
      });

      await tx.event.create({
        data: {
          applicationId: application.id,
          userId: application.userId,
          type: "ANALYSIS_RUN",
          body: `Match score ${result.matchScore} · ${provider.name}/${provider.model}`,
        },
      });

      await tx.application.update({
        where: { id: application.id },
        data: { latestMatchScore: result.matchScore, lastAnalyzedAt: new Date() },
      });
    });

    revalidatePath(`/applications/${application.id}`);
    revalidatePath("/applications");
    return { ranAt: Date.now() };
  } catch (error) {
    if (error instanceof AnalysisError) {
      return { error: error.message };
    }
    // Surfaced, not swallowed — but without leaking provider internals.
    console.error("Analysis failed:", error);
    return {
      error:
        error instanceof Error
          ? `Analysis failed: ${error.message}`
          : "Analysis failed for an unknown reason.",
    };
  }
}
