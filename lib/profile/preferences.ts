"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { db } from "../db";
import { getProvider } from "../llm";
import * as suggestPrompt from "../llm/prompts/suggest-preferences.v1";
import { AnalysisError, completeWithRepair } from "../llm/repair";
import { LlmAuthError, LlmQuotaError } from "../llm/types";
import { assertWithinBudget, recordProviderCall, UsageLimitError } from "../llm/usage";
import {
  jobPreferencesFormSchema,
  preferenceSuggestionSchema,
  type PreferenceSuggestion,
} from "../schemas/job-preferences";
import { getProfile } from "./get";

export type PreferencesState = { error?: string; savedAt?: number };

export async function getJobPreferences() {
  const user = await requireUser();
  return db.jobPreferences.findUnique({ where: { userId: user.id } });
}

export async function saveJobPreferences(
  _prev: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const user = await requireUser();

  const parsed = jobPreferencesFormSchema.safeParse({
    targetRoles: formData.getAll("targetRoles"),
    city: formData.get("city"),
    country: formData.get("country"),
    remote: formData.get("remote"),
    seniority: formData.get("seniority"),
    languages: formData.getAll("languages"),
    excludeKeywords: formData.getAll("excludeKeywords"),
    autoSearch: formData.get("autoSearch") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await db.jobPreferences.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });

  revalidatePath("/profile");
  revalidatePath("/leads");
  return { savedAt: Date.now() };
}

export type SuggestState = { error?: string; suggestion?: PreferenceSuggestion };

/**
 * One budgeted call that reads the CV and returns a proposal. Nothing is
 * written: the form takes the suggestion into its fields and the owner saves
 * — or doesn't. The proposal only ever fills empty fields on the client, so
 * it cannot overwrite something the owner already decided.
 */
export async function suggestJobPreferences(
  _prev: SuggestState,
  _formData: FormData,
): Promise<SuggestState> {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile?.cvText.trim()) {
    return { error: "Add your CV text first — the suggestion reads it." };
  }

  try {
    await assertWithinBudget(user.id);
    const provider = getProvider();
    const out = await completeWithRepair(
      provider,
      {
        system: suggestPrompt.system,
        user: suggestPrompt.buildUserPrompt({ cvText: profile.cvText, skills: profile.skills }),
        temperature: 0.2,
        maxTokens: 800,
      },
      preferenceSuggestionSchema,
      (usage) => recordProviderCall(user.id, usage),
    );
    return {
      suggestion: {
        ...out.data,
        targetRoles: [...new Set(out.data.targetRoles.map((r) => r.trim().toLowerCase()))],
      },
    };
  } catch (error) {
    if (
      error instanceof UsageLimitError ||
      error instanceof AnalysisError ||
      error instanceof LlmAuthError ||
      error instanceof LlmQuotaError
    ) {
      return { error: error.message };
    }
    console.error("Preference suggestion failed:", error);
    return { error: "The suggestion failed partway through. Nothing was changed." };
  }
}
