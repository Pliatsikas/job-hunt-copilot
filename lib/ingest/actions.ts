"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAnalysis } from "../analysis/run";
import { requireUser } from "../auth";
import { db } from "../db";
import { AnalysisError } from "../llm/repair";
import { LlmAuthError, LlmQuotaError } from "../llm/types";
import { UsageLimitError } from "../llm/usage";
import { getProfile } from "../profile/get";
import { dedupeKey } from "./dedupe";
import { scoreFit } from "./fit";
import { runJobSearch } from "./search";
import { EMPLOYER_SOURCES, SOURCES } from "./sources";
import { SourceError } from "./sources/types";

export type IngestState = { error?: string; message?: string };

/** "Find jobs now": the whole search, one click, no model calls. */
export async function findJobsNow(_prev: IngestState, _formData: FormData): Promise<IngestState> {
  const user = await requireUser();
  try {
    const r = await runJobSearch(user.id);
    revalidatePath("/leads");
    const failed = r.boardsFailed.length ? ` ${r.boardsFailed.length} board(s) could not be read.` : "";
    return {
      message: `${r.postings} postings from ${r.boards} boards · ${r.created} new that fit · ${r.alreadyKnown} already here · ${r.filteredOut} not a fit.${failed}`,
    };
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    return { error: "The search failed partway through." };
  }
}

const watchSchema = z.object({
  source: z.enum(EMPLOYER_SOURCES),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/i, "Just the slug: letters, digits and dashes"),
});

/** Watch one more employer's board. Verified by fetching it once, so a typo fails here, not silently every day. */
export async function watchEmployer(_prev: IngestState, formData: FormData): Promise<IngestState> {
  const user = await requireUser();
  const parsed = watchSchema.safeParse({ source: formData.get("source"), slug: formData.get("slug") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { source, slug } = parsed.data;

  let jobs;
  try {
    jobs = await SOURCES[source].fetchJobs(slug);
  } catch (error) {
    return { error: error instanceof SourceError ? error.message : `${source} could not be reached.` };
  }
  const name = jobs[0]?.companyName ?? slug;
  await db.savedSearch.upsert({
    where: { id: `${user.id}:${source}:${slug.toLowerCase()}` },
    update: {},
    create: { id: `${user.id}:${source}:${slug.toLowerCase()}`, userId: user.id, name, source, query: slug.toLowerCase() },
  });
  revalidatePath("/leads");
  return { message: `Watching ${name} — ${jobs.length} postings on their board right now. They will be included next time you search.` };
}

export async function unwatchEmployer(id: string): Promise<void> {
  const user = await requireUser();
  await db.savedSearch.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/leads");
}

const captureSchema = z.object({
  title: z.string().trim().min(3).max(200),
  url: z.url(),
  text: z.string().trim().min(80, "Too little text on that page to work with").max(40_000),
  company: z.string().trim().max(120).optional(),
});

/**
 * The bookmarklet's landing action. The page text arrived in the URL
 * fragment of a top-level navigation the owner made, and the owner has
 * looked at it on /leads/capture and pressed save — nothing here fetched
 * anything from anywhere.
 */
export async function captureLead(_prev: IngestState, formData: FormData): Promise<IngestState> {
  const user = await requireUser();
  const parsed = captureSchema.safeParse({
    title: formData.get("title"),
    url: formData.get("url"),
    text: formData.get("text"),
    company: formData.get("company") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { title, url, text } = parsed.data;
  const host = new URL(url).hostname.replace(/^www\./, "");
  const company = parsed.data.company?.trim() || host;

  const [prefs, profile] = await Promise.all([
    db.jobPreferences.findUnique({ where: { userId: user.id } }),
    getProfile(),
  ]);
  const fit = prefs
    ? scoreFit(
        { title, description: text, location: null, remote: null },
        { targetRoles: prefs.targetRoles, skills: profile?.skills ?? [], city: prefs.city, country: prefs.country, remote: prefs.remote, seniority: prefs.seniority, excludeKeywords: [] },
      )
    : null;

  const key = dedupeKey(company, title);
  const existing = await db.lead.findUnique({ where: { userId_dedupeKey: { userId: user.id, dedupeKey: key } } });
  if (existing) {
    revalidatePath("/leads");
    redirect("/leads?captured=known");
  }

  await db.lead.create({
    data: {
      userId: user.id,
      source: "BOOKMARKLET",
      externalId: url,
      dedupeKey: key,
      companyName: company,
      roleTitle: title,
      jobUrl: url,
      jobDescription: text,
      fitScore: fit?.score ?? null,
      matchedTerms: fit?.matchedTerms ?? [],
    },
  });
  revalidatePath("/leads");
  redirect("/leads?captured=1");
}

async function scoreOne(userId: string, id: string): Promise<{ ok: boolean; reason: string | null }> {
  const profile = await getProfile();
  if (!profile?.cvText.trim()) return { ok: false, reason: "no CV on the profile yet" };
  const lead = await db.lead.findFirst({ where: { id, userId } });
  if (!lead) return { ok: false, reason: "not found" };
  try {
    const run = await runAnalysis({ userId, cvText: profile.cvText, skills: profile.skills, jobDescription: lead.jobDescription });
    await db.lead.update({
      where: { id: lead.id },
      data: { matchScore: run.result.matchScore, analysis: run.result, droppedClaims: run.droppedClaims, scoredAt: new Date() },
    });
    return { ok: true, reason: null };
  } catch (error) {
    if (error instanceof UsageLimitError || error instanceof LlmQuotaError || error instanceof LlmAuthError || error instanceof AnalysisError) {
      return { ok: false, reason: error.message };
    }
    console.error("Lead scoring failed:", error);
    return { ok: false, reason: "scoring failed partway through" };
  }
}

export async function scoreLead(id: string, _prev: IngestState, _formData: FormData): Promise<IngestState> {
  const user = await requireUser();
  const out = await scoreOne(user.id, id);
  revalidatePath("/leads");
  return out.ok ? { message: "Scored." } : { error: out.reason ?? "Could not score." };
}

export async function dismissLead(id: string): Promise<void> {
  const user = await requireUser();
  await db.lead.updateMany({ where: { id, userId: user.id, status: "NEW" }, data: { status: "DISMISSED" } });
  revalidatePath("/leads");
}
