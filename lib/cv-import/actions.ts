"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../auth";
import { db } from "../db";
import { getProvider } from "../llm";
import * as cleanupPrompt from "../llm/prompts/cv-cleanup.v1";
import { AnalysisError, completeWithRepair } from "../llm/repair";
import { LlmAuthError, LlmQuotaError } from "../llm/types";
import { assertWithinBudget, recordProviderCall, UsageLimitError } from "../llm/usage";
import { applyImportedCvSchema, cvCleanupSchema } from "../schemas/cv-import";
import { CvImportError, extractPdfText } from "./extract";
import { assessImportQuality, type ImportQuality } from "./quality";
import { redactContactDetails } from "./redact";

export type ImportResult = {
  error?: string;
  /** Present only on success. Nothing is saved until the user reviews it. */
  draft?: {
    text: string;
    pages: number;
    redacted: { emails: number; phones: number };
    quality: ImportQuality;
    rawChars: number;
  };
};

const CLEANUP_TEMPERATURE = 0.1;
const CLEANUP_MAX_TOKENS = 6000;

/**
 * Upload → extract → redact → one cleanup pass → back to the client as a
 * draft. Deliberately no write: the review screen is mandatory (SPEC.md §6.2)
 * because no automatic pass here is trustworthy on its own, and a CV that was
 * silently replaced by a mangled import would poison every analysis after it.
 *
 * Order matters. Redaction runs before the provider call, so the email and
 * phone number never leave the server. The budget is checked before the call
 * and the call is counted after it, like every other provider call.
 */
export async function importCvFromPdf(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const user = await requireUser();

  const file = formData.get("pdf");
  if (!(file instanceof File)) return { error: "Choose a PDF first." };

  try {
    const extracted = await extractPdfText(file);
    const redaction = redactContactDetails(extracted.text);

    await assertWithinBudget(user.id);

    const provider = getProvider();
    const out = await completeWithRepair(
      provider,
      {
        system: cleanupPrompt.system,
        user: cleanupPrompt.buildUserPrompt(redaction.text),
        temperature: CLEANUP_TEMPERATURE,
        maxTokens: CLEANUP_MAX_TOKENS,
      },
      cvCleanupSchema,
      (usage) => recordProviderCall(user.id, usage),
    );

    // Belt and braces: the model was told to drop contact details it found,
    // but a second pass over its output costs nothing and the promise that
    // nothing reaches the profile is worth keeping in code.
    const lines = out.data.lines.map((l) => l.trim()).filter(Boolean);
    const final = redactContactDetails(lines.join("\n"));

    return {
      draft: {
        text: final.text,
        pages: extracted.pages,
        redacted: {
          emails: redaction.emails + final.emails,
          phones: redaction.phones + final.phones,
        },
        quality: assessImportQuality(final.text.split("\n")),
        rawChars: extracted.text.length,
      },
    };
  } catch (error) {
    if (
      error instanceof CvImportError ||
      error instanceof UsageLimitError ||
      error instanceof AnalysisError ||
      error instanceof LlmAuthError ||
      error instanceof LlmQuotaError
    ) {
      return { error: error.message };
    }
    console.error("CV import failed:", error);
    return { error: "The import failed partway through. Nothing was changed." };
  }
}

export type ApplyState = { error?: string };

/** The reviewed text becomes the CV. Same writer as the profile form. */
export async function applyImportedCv(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const user = await requireUser();

  const parsed = applyImportedCvSchema.safeParse({ cvText: formData.get("cvText") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await db.profile.upsert({
    where: { userId: user.id },
    update: { cvText: parsed.data.cvText },
    create: { userId: user.id, cvText: parsed.data.cvText, skills: [] },
  });

  revalidatePath("/profile");
  revalidatePath("/today");
  // The guide sends people here from step 1 and wants them back at step 2.
  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/profile?imported=1");
}
