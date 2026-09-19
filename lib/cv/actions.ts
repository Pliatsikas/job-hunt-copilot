"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { db } from "../db";
import { getProvider } from "../llm";
import * as structurePrompt from "../llm/prompts/cv-structure.v1";
import { AnalysisError, completeWithRepair } from "../llm/repair";
import { LlmAuthError, LlmQuotaError } from "../llm/types";
import { assertWithinBudget, recordProviderCall, UsageLimitError } from "../llm/usage";
import { getProfile } from "../profile/get";
import { cvDesignSchema, readDesign } from "../schemas/cv-design";
import { CV_LANGUAGES, EMPTY_CV, extractedCvSchema, photoSchema, structuredCvSchema, type CvLanguage, type StructuredCv } from "../schemas/structured-cv";
import { groundExtraction } from "./extract-grounding";
import { ensureIds } from "./ids";

export type CvSaveState = { error?: string; savedAt?: number };

function parseLanguage(value: unknown): CvLanguage | null {
  return CV_LANGUAGES.includes(value as CvLanguage) ? (value as CvLanguage) : null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * The editor posts the whole CV as one JSON field. Validated by the same
 * schema the readers use; ids are assigned to anything new so the tailoring
 * selection always has something to point at.
 */
export async function saveStructuredCv(_prev: CvSaveState, formData: FormData): Promise<CvSaveState> {
  const user = await requireUser();
  const language = parseLanguage(formData.get("language"));
  if (!language) return { error: "Unknown language." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("cv") ?? ""));
  } catch {
    return { error: "The form could not be read. Reload and try again." };
  }
  const parsed = structuredCvSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue?.path.join(".") || "cv"}: ${issue?.message ?? "invalid"}` };
  }
  const data = ensureIds(parsed.data);

  // The builder posts its design choices alongside; the plain editor does not.
  const designRaw = formData.get("design");
  const design = typeof designRaw === "string" && designRaw ? readDesign(safeJson(designRaw)) : undefined;

  await db.structuredCv.upsert({
    where: { userId_language: { userId: user.id, language } },
    update: { data, ...(design ? { design } : {}) },
    create: { userId: user.id, language, data, design: design ?? readDesign(null) },
  });
  revalidatePath("/profile/cv");
  revalidatePath("/cv/builder");
  return { savedAt: Date.now() };
}

export type ExtractState = { error?: string; cv?: StructuredCv; dropped?: string[] };

/**
 * One budgeted call that sorts the profile's CV text into the structure.
 * Nothing is saved: the result fills the editor, grounded string by string
 * against the source, and the owner presses save — or does not.
 */
export async function extractStructuredCv(_prev: ExtractState, _formData: FormData): Promise<ExtractState> {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile?.cvText.trim()) return { error: "Add your CV text first — the extraction reads it." };

  try {
    await assertWithinBudget(user.id);
    const out = await completeWithRepair(
      getProvider(),
      {
        system: structurePrompt.system,
        user: structurePrompt.buildUserPrompt({ cvText: profile.cvText }),
        temperature: 0,
        // Sorting, not deliberating: at default reasoning gpt-oss spent the
        // whole output allowance thinking and returned nothing. 5 000 plus a
        // ~2 300-token prompt stays under Groq's 8 000-per-minute request cap.
        maxTokens: 5000,
        reasoning: "low",
      },
      extractedCvSchema,
      (usage) => recordProviderCall(user.id, usage),
    );
    const grounded = groundExtraction(out.data, profile.cvText);
    return { cv: ensureIds(grounded.cv), dropped: grounded.dropped };
  } catch (error) {
    if (
      error instanceof UsageLimitError ||
      error instanceof AnalysisError ||
      error instanceof LlmAuthError ||
      error instanceof LlmQuotaError
    ) {
      return { error: error.message };
    }
    console.error("CV extraction failed:", error);
    return { error: "The extraction failed partway through. Nothing was changed." };
  }
}

export type PhotoState = { error?: string; savedAt?: number };

/** The browser resized it already; the server only checks the shape and the size. */
export async function savePhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const user = await requireUser();
  const parsed = photoSchema.safeParse(formData.get("photo"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Not an image the CV can use." };
  await db.profile.upsert({
    where: { userId: user.id },
    update: { photo: parsed.data },
    create: { userId: user.id, cvText: "", skills: [], photo: parsed.data },
  });
  revalidatePath("/profile/cv");
  return { savedAt: Date.now() };
}

export async function removePhoto(): Promise<void> {
  const user = await requireUser();
  await db.profile.updateMany({ where: { userId: user.id }, data: { photo: null } });
  revalidatePath("/profile/cv");
}

/** The builder's design alone — template, accent, photo switch — without touching the CV. */
export async function saveDesign(_prev: CvSaveState, formData: FormData): Promise<CvSaveState> {
  const user = await requireUser();
  const language = parseLanguage(formData.get("language"));
  if (!language) return { error: "Unknown language." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("design") ?? ""));
  } catch {
    return { error: "The design could not be read." };
  }
  const parsed = cvDesignSchema.safeParse(raw);
  if (!parsed.success) return { error: "Unknown design." };
  await db.structuredCv.upsert({
    where: { userId_language: { userId: user.id, language } },
    update: { design: parsed.data },
    create: { userId: user.id, language, data: EMPTY_CV, design: parsed.data },
  });
  revalidatePath("/cv/builder");
  return { savedAt: Date.now() };
}
