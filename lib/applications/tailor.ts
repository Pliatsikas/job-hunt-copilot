"use server";

import { revalidatePath } from "next/cache";
import { getProvider } from "../llm";
import * as tailorPrompt from "../llm/prompts/tailor-cv.v1";
import * as tailorPromptV2 from "../llm/prompts/tailor-cv.v2";
import { getStructuredCvFor } from "../cv/queries";
import { applySelection, renderStructuredCvText } from "../cv/select";
import { cvSelectionSchema } from "../schemas/cv-selection";
import { CV_LABELS, CV_LANGUAGES, type CvLanguage } from "../schemas/structured-cv";
import { AnalysisError, completeWithRepair } from "../llm/repair";
import { cvLines, groundTailoredCv, renderTailoredCv } from "../llm/tailor-grounding";
import { LlmAuthError, LlmQuotaError } from "../llm/types";
import { assertWithinBudget, recordProviderCall, UsageLimitError } from "../llm/usage";
import { getProfile } from "../profile/get";
import { tailoredCvSchema } from "../schemas/tailored-cv";
import { getLatestAnalysisResult, saveGeneratedDocument } from "./documents";
import { requireOwnedApplication } from "./guards";

export type TailorState = {
  error?: string;
  version?: number;
  /** "designed" when built from the structured CV (T09), "text" for the line-based fallback. */
  kind?: "designed" | "text";
  /** Lines the model returned that were not the CV's; shown so the drop is visible. */
  droppedLines?: string[];
  coverage?: number;
  keywordsAddressed?: string[];
};

const TAILOR_TEMPERATURE = 0.1;
const TAILOR_MAX_TOKENS = 4096;

/**
 * If more than this share of returned lines fails grounding, the output is
 * refused rather than saved with holes. A CV missing a third of what the
 * model meant to include is not a tailored CV; it is a broken one.
 */
const MAX_DROPPED_SHARE = 0.34;

/**
 * Not streamed, for the same reason the analysis is not (SPEC.md §8 Α4): the
 * output is validated line by line against the CV before anything is shown,
 * and a partial JSON object cannot be validated mid-stream.
 */
export async function tailorCv(
  applicationId: string,
  _prev: TailorState,
  formData: FormData,
): Promise<TailorState> {
  try {
    const application = await requireOwnedApplication(applicationId);

    // The ordering is built around the analysis's keywords and matches; without
    // one there is nothing to tailor towards, and guessing would be worse.
    const analysis = await getLatestAnalysisResult(application.id, application.userId);
    if (!analysis) {
      return { error: "Run the analysis first. The tailored CV is ordered around its keywords and matched skills." };
    }

    // T09: a structured CV in the asked-for language gives the designed
    // document; otherwise the line-based text path below still works.
    const requested = formData.get("language");
    const language: CvLanguage = CV_LANGUAGES.includes(requested as CvLanguage) ? (requested as CvLanguage) : "en";
    const structured = await getStructuredCvFor(application.userId, language);
    if (structured) {
      await assertWithinBudget(application.userId);
      const completion = await completeWithRepair(
        getProvider(),
        {
          system: tailorPromptV2.system,
          user: tailorPromptV2.buildUserPrompt({
            cv: structured,
            jobDescription: application.jobDescription,
            roleTitle: application.roleTitle,
            analysis,
          }),
          temperature: TAILOR_TEMPERATURE,
          maxTokens: TAILOR_MAX_TOKENS,
        },
        cvSelectionSchema,
        (usage) => recordProviderCall(application.userId, usage),
      );
      const applied = applySelection(structured, completion.data);
      const version = await saveGeneratedDocument({
        applicationId: application.id,
        userId: application.userId,
        type: "CV_TAILORED",
        language,
        content: renderStructuredCvText(applied.cv, CV_LABELS[language]),
        data: { source: "structured", language, cv: applied.cv, keywordsAddressed: completion.data.keywordsAddressed },
      });
      revalidatePath(`/applications/${application.id}`);
      return {
        version,
        kind: "designed",
        coverage: applied.coverage,
        keywordsAddressed: completion.data.keywordsAddressed,
        droppedLines: applied.unknownIds,
      };
    }

    const profile = await getProfile();
    if (!profile?.cvText.trim()) {
      return { error: "Add your CV text on the profile page first — there is nothing to tailor." };
    }

    await assertWithinBudget(application.userId);

    const lines = cvLines(profile.cvText);
    const provider = getProvider();
    const completion = await completeWithRepair(
      provider,
      {
        system: tailorPrompt.system,
        user: tailorPrompt.buildUserPrompt({
          cvLines: lines,
          jobDescription: application.jobDescription,
          roleTitle: application.roleTitle,
          analysis,
        }),
        temperature: TAILOR_TEMPERATURE,
        maxTokens: TAILOR_MAX_TOKENS,
      },
      tailoredCvSchema,
      (usage) => recordProviderCall(application.userId, usage),
    );

    const grounded = groundTailoredCv(
      completion.data,
      profile.cvText,
      analysis.gaps.map((g) => g.skill),
    );

    const returned = completion.data.sections.reduce((n, s) => n + s.lines.length, 0);
    const kept = grounded.cv.sections.reduce((n, s) => n + s.lines.length, 0);
    if (kept === 0 || grounded.droppedLines.length / Math.max(returned, 1) > MAX_DROPPED_SHARE) {
      return {
        error: `The model changed too many lines to save this — ${grounded.droppedLines.length} of ${returned} were not your CV's own text. Nothing was saved. Try again; if it keeps happening, the CV may need one sentence per line.`,
        droppedLines: grounded.droppedLines,
      };
    }

    const version = await saveGeneratedDocument({
      applicationId: application.id,
      userId: application.userId,
      type: "CV_TAILORED",
      // A CV keeps the language it was written in — there is no "translate".
      language: /\p{Script=Greek}/u.test(profile.cvText) ? "el" : "en",
      content: renderTailoredCv(grounded.cv),
    });

    revalidatePath(`/applications/${application.id}`);
    return {
      version,
      kind: "text",
      droppedLines: grounded.droppedLines,
      coverage: grounded.coverage,
      keywordsAddressed: grounded.cv.keywordsAddressed,
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
    console.error("Tailoring failed:", error);
    return { error: "Tailoring failed partway through. Nothing was saved." };
  }
}
