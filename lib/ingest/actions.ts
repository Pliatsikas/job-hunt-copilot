"use server";

import { revalidatePath } from "next/cache";
import { runAnalysis } from "../analysis/run";
import { requireUser } from "../auth";
import { db } from "../db";
import { AnalysisError } from "../llm/repair";
import { LlmAuthError, LlmQuotaError } from "../llm/types";
import { UsageLimitError } from "../llm/usage";
import { getProfile } from "../profile/get";
import { savedSearchSchema } from "../schemas/ingest";
import { dedupeKey } from "./dedupe";
import { SOURCES } from "./sources";
import { SourceError } from "./sources/types";

export type IngestState = { error?: string; message?: string };

/**
 * How many freshly arrived leads get scored automatically per run. Scoring
 * is a provider call each, against a budget of twelve a day for a visitor,
 * so a search that returns eighty postings must not spend the day's
 * allowance before the person has looked at one of them. The rest wait for
 * an explicit click, and the run says how many.
 */
const SCORE_ON_ARRIVAL_LIMIT = 3;

export async function createSavedSearch(_prev: IngestState, formData: FormData): Promise<IngestState> {
  const user = await requireUser();
  const parsed = savedSearchSchema.safeParse({
    name: formData.get("name"),
    source: formData.get("source"),
    query: formData.get("query"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await db.savedSearch.create({ data: { ...parsed.data, userId: user.id } });
  revalidatePath("/leads");
  return { message: `Saved "${parsed.data.name}". Run it to fetch postings.` };
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const user = await requireUser();
  // deleteMany with the ownership filter: a foreign id deletes nothing.
  await db.savedSearch.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/leads");
}

/**
 * Fetch, normalize, dedupe, insert, then score the newest few. Everything up
 * to scoring is free and runs to completion; scoring stops at the first
 * budget refusal and says so, because a search must never fail *because*
 * the budget is spent — the postings are still worth seeing unscored.
 */
export async function runSavedSearch(id: string, _prev: IngestState, _formData: FormData): Promise<IngestState> {
  const user = await requireUser();
  const search = await db.savedSearch.findFirst({ where: { id, userId: user.id } });
  if (!search) return { error: "That search does not exist." };

  let jobs;
  try {
    jobs = await SOURCES[search.source].fetchJobs(search.query);
  } catch (error) {
    if (error instanceof SourceError) return { error: error.message };
    console.error("Source fetch failed:", error);
    return { error: `${search.source} could not be reached.` };
  }

  // One statement, not a loop. The first version inserted row by row inside
  // an interactive transaction and a board with 87 postings blew through the
  // 5-second transaction timeout over a pooled Neon connection. createMany
  // with skipDuplicates also lets the unique (userId, dedupeKey) constraint
  // do the dedupe itself — no pre-read of existing keys, no race between it
  // and the insert. Duplicates inside one fetch are still collapsed here,
  // because the constraint would reject the batch rather than skip them.
  const seen = new Set<string>();
  const candidates = jobs
    .filter((j) => j.roleTitle && j.jobDescription.length >= 80)
    .map((j) => ({ ...j, dedupeKey: dedupeKey(j.companyName, j.roleTitle) }))
    .filter((j) => (seen.has(j.dedupeKey) ? false : (seen.add(j.dedupeKey), true)));

  const created = await db.lead.createManyAndReturn({
    data: candidates.map((job) => ({
      userId: user.id,
      savedSearchId: search.id,
      source: search.source,
      externalId: job.externalId,
      dedupeKey: job.dedupeKey,
      companyName: job.companyName,
      roleTitle: job.roleTitle,
      location: job.location,
      jobUrl: job.jobUrl,
      jobDescription: job.jobDescription,
      postedAt: job.postedAt,
    })),
    skipDuplicates: true,
    select: { id: true },
  });
  await db.savedSearch.update({ where: { id: search.id }, data: { lastRunAt: new Date() } });

  const scoring = await scoreLeads(
    user.id,
    created.slice(0, SCORE_ON_ARRIVAL_LIMIT).map((r) => r.id),
  );

  revalidatePath("/leads");
  const skipped = jobs.length - created.length;
  return {
    message:
      `${jobs.length} postings from ${search.source}: ${created.length} new, ${skipped} already known. ` +
      (created.length
        ? `Scored ${scoring.scored} on arrival` +
          (scoring.stoppedBecause ? ` — stopped: ${scoring.stoppedBecause}` : "") +
          (created.length > scoring.scored ? `; ${created.length - scoring.scored} waiting for a click.` : ".")
        : ""),
  };
}

async function scoreLeads(userId: string, ids: string[]): Promise<{ scored: number; stoppedBecause: string | null }> {
  if (!ids.length) return { scored: 0, stoppedBecause: null };
  const profile = await getProfile();
  if (!profile?.cvText.trim()) return { scored: 0, stoppedBecause: "no CV on the profile yet" };

  let scored = 0;
  for (const id of ids) {
    const lead = await db.lead.findFirst({ where: { id, userId } });
    if (!lead) continue;
    try {
      const run = await runAnalysis({
        userId,
        cvText: profile.cvText,
        skills: profile.skills,
        jobDescription: lead.jobDescription,
      });
      await db.lead.update({
        where: { id: lead.id },
        data: {
          matchScore: run.result.matchScore,
          analysis: run.result,
          droppedClaims: run.droppedClaims,
          scoredAt: new Date(),
        },
      });
      scored += 1;
    } catch (error) {
      if (
        error instanceof UsageLimitError ||
        error instanceof LlmQuotaError ||
        error instanceof LlmAuthError ||
        error instanceof AnalysisError
      ) {
        return { scored, stoppedBecause: error.message };
      }
      console.error("Lead scoring failed:", error);
      return { scored, stoppedBecause: "scoring failed partway through" };
    }
  }
  return { scored, stoppedBecause: null };
}

export async function scoreLead(id: string, _prev: IngestState, _formData: FormData): Promise<IngestState> {
  const user = await requireUser();
  const out = await scoreLeads(user.id, [id]);
  revalidatePath("/leads");
  return out.scored ? { message: "Scored." } : { error: out.stoppedBecause ?? "Could not score." };
}

export async function dismissLead(id: string): Promise<void> {
  const user = await requireUser();
  await db.lead.updateMany({ where: { id, userId: user.id, status: "NEW" }, data: { status: "DISMISSED" } });
  revalidatePath("/leads");
}
