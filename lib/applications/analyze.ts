"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getProvider } from "../llm";
import { groundAnalysis } from "../llm/grounding";
import * as analyzePrompt from "../llm/prompts/analyze.v1";
import { AnalysisError, completeWithRepair } from "../llm/repair";
import { assertWithinBudget, recordProviderCall, UsageLimitError } from "../llm/usage";
import { LlmAuthError, LlmQuotaError } from "../llm/types";
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

    await assertWithinBudget(application.userId);

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
      (usage) => recordProviderCall(application.userId, usage),
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
    // Already says which ceiling was hit and when it lifts — never rewrap it
    // into a generic failure (SPEC.md §6.1).
    if (error instanceof UsageLimitError) {
      return { error: error.message };
    }
    if (error instanceof AnalysisError) {
      return { error: error.message };
    }
    // A rejected key already carries a readable message naming the variable —
    // pass it through rather than wrapping raw provider JSON in a prefix.
    if (error instanceof LlmAuthError || error instanceof LlmQuotaError) {
      console.error(`Provider ${error.name} (${error.provider}):`, error.cause);
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
