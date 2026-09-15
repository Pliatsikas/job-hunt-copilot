import { htmlToText } from "../html-to-text";
import { cleanQuery, fetchJson } from "./fetch";
import type { NormalizedJob, SourceAdapter } from "./types";

type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  url?: string;
  location?: string;
  created_at?: number;
};

/**
 * Arbeitnow Job Board API — free, no key, terms permit this use:
 * https://www.arbeitnow.com/api. Europe-heavy, which suits a candidate in
 * Greece better than most.
 */
export const arbeitnow: SourceAdapter = {
  source: "ARBEITNOW",
  label: "Arbeitnow (EU jobs)",
  queryHint: "A search term, e.g. typescript or fullstack.",
  host: "www.arbeitnow.com",

  async fetchJobs(query: string): Promise<NormalizedJob[]> {
    const q = cleanQuery(query);
    const data = await fetchJson<{ data?: ArbeitnowJob[] }>(
      "ARBEITNOW",
      this.host,
      `https://${this.host}/api/job-board-api?search=${encodeURIComponent(q)}`,
    );
    return (data.data ?? []).map((job) => ({
      externalId: job.slug,
      companyName: job.company_name.trim(),
      roleTitle: job.title.trim(),
      location: job.location?.trim() || null,
      jobUrl: job.url ?? null,
      jobDescription: htmlToText(job.description ?? ""),
      postedAt: job.created_at ? new Date(job.created_at * 1000) : null,
    }));
  },
};
