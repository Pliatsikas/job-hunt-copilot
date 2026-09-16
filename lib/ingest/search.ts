import type { LeadSource } from "@prisma/client";
import { db } from "../db";
import { dedupeKey } from "./dedupe";
import { CURATED_EMPLOYERS } from "./employers";
import { scoreFit, type FitPreferences } from "./fit";
import { SOURCES } from "./sources";
import type { NormalizedJob } from "./sources/types";

export type SearchReport = {
  boards: number;
  boardsFailed: string[];
  postings: number;
  /** Excluded by fit before insert: wrong field, wrong place, exclude keyword. */
  filteredOut: number;
  created: number;
  alreadyKnown: number;
};

/** Below this the posting is not shown at all. Tuned on the curated boards. */
export const MIN_FIT_TO_KEEP = 25;

type Target = { source: Exclude<LeadSource, "BOOKMARKLET">; query: string; label: string };

/**
 * What to ask, derived from preferences rather than typed by the person:
 * every watched employer board, plus keyword sources where the preferences
 * make them relevant — Remotive only if remote is acceptable, Arbeitnow only
 * for Germany, since it carries nothing else.
 */
export async function buildTargets(userId: string, prefs: FitPreferences & { remoteOk: boolean }): Promise<Target[]> {
  const targets: Target[] = CURATED_EMPLOYERS.map((e) => ({ source: e.source, query: e.slug, label: e.name }));

  const watched = await db.savedSearch.findMany({ where: { userId }, select: { source: true, query: true, name: true } });
  for (const w of watched) {
    if (w.source === "BOOKMARKLET") continue;
    if (!targets.some((t) => t.source === w.source && t.query === w.query)) {
      targets.push({ source: w.source, query: w.query, label: w.name });
    }
  }

  if (prefs.remoteOk) {
    for (const role of prefs.targetRoles.slice(0, 3)) targets.push({ source: "REMOTIVE", query: role, label: `Remotive · ${role}` });
  }
  if (prefs.country && /germany|deutschland/i.test(prefs.country)) {
    for (const role of prefs.targetRoles.slice(0, 3)) targets.push({ source: "ARBEITNOW", query: role, label: `Arbeitnow · ${role}` });
  }
  return targets;
}

/**
 * The whole search for one person: fetch every target, score every posting
 * against their preferences, keep what plausibly fits, insert what is new.
 * No model call anywhere in here — this is what makes it safe to run for
 * every user every day (T05). Boards that fail are reported, not fatal: one
 * employer moving ATS must not empty everyone's queue.
 */
export async function runJobSearch(userId: string): Promise<SearchReport> {
  const [prefs, profile] = await Promise.all([
    db.jobPreferences.findUnique({ where: { userId } }),
    db.profile.findUnique({ where: { userId }, select: { skills: true } }),
  ]);
  if (!prefs || prefs.targetRoles.length === 0) {
    throw new Error("Set what you are looking for on your profile first.");
  }

  const fitPrefs: FitPreferences = {
    targetRoles: prefs.targetRoles,
    skills: profile?.skills ?? [],
    city: prefs.city,
    country: prefs.country,
    remote: prefs.remote,
    seniority: prefs.seniority,
    excludeKeywords: prefs.excludeKeywords,
  };
  const targets = await buildTargets(userId, { ...fitPrefs, remoteOk: prefs.remote === "REMOTE_ONLY" || prefs.remote === "REMOTE_OK" || prefs.remote === "ANY" });

  const boardsFailed: string[] = [];
  const results = await Promise.allSettled(
    targets.map(async (t) => ({ target: t, jobs: await SOURCES[t.source].fetchJobs(t.query) })),
  );

  const candidates: Array<NormalizedJob & { source: LeadSource; dedupeKey: string; fitScore: number; matchedTerms: string[] }> = [];
  let postings = 0;
  let filteredOut = 0;
  const seen = new Set<string>();

  for (const r of results) {
    if (r.status === "rejected") {
      boardsFailed.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
      continue;
    }
    for (const job of r.value.jobs) {
      postings += 1;
      if (!job.roleTitle || job.jobDescription.length < 80) { filteredOut += 1; continue; }
      const key = dedupeKey(job.companyName, job.roleTitle);
      if (seen.has(key)) continue;
      seen.add(key);

      const fit = scoreFit(
        { title: job.roleTitle, description: job.jobDescription, location: job.location, remote: job.remote ?? null },
        fitPrefs,
      );
      if (fit.score === null || fit.score < MIN_FIT_TO_KEEP) { filteredOut += 1; continue; }
      candidates.push({ ...job, source: r.value.target.source, dedupeKey: key, fitScore: fit.score, matchedTerms: fit.matchedTerms });
    }
  }

  const created = await db.lead.createManyAndReturn({
    data: candidates.map((c) => ({
      userId,
      source: c.source,
      externalId: c.externalId,
      dedupeKey: c.dedupeKey,
      companyName: c.companyName,
      roleTitle: c.roleTitle,
      location: c.location,
      jobUrl: c.jobUrl,
      jobDescription: c.jobDescription,
      postedAt: c.postedAt,
      fitScore: c.fitScore,
      matchedTerms: c.matchedTerms,
    })),
    skipDuplicates: true,
    select: { id: true },
  });

  await db.jobPreferences.update({ where: { userId }, data: { lastAutoRunAt: new Date() } });

  return {
    boards: targets.length,
    boardsFailed,
    postings,
    filteredOut,
    created: created.length,
    alreadyKnown: candidates.length - created.length,
  };
}
