import { htmlToText } from "../html-to-text";
import { cleanQuery, fetchJson } from "./fetch";
import type { NormalizedJob, SourceAdapter } from "./types";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url?: string;
  content?: string;
  company_name?: string;
  first_published?: string;
  updated_at?: string;
  location?: { name?: string };
};

/**
 * Greenhouse Job Board API — public, documented, built for exactly this:
 * https://developers.greenhouse.io/job-board.html. `content=true` returns
 * the posting body, HTML-escaped.
 */
export const greenhouse: SourceAdapter = {
  source: "GREENHOUSE",
  label: "Greenhouse board",
  queryHint: "The company's board slug — the part after boards.greenhouse.io/ (e.g. vercel).",
  host: "boards-api.greenhouse.io",

  async fetchJobs(query: string): Promise<NormalizedJob[]> {
    const slug = cleanQuery(query).replace(/\s+/g, "");
    const data = await fetchJson<{ jobs?: GreenhouseJob[] }>(
      "GREENHOUSE",
      this.host,
      `https://${this.host}/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
    );
    return (data.jobs ?? []).map((job) => ({
      externalId: String(job.id),
      companyName: job.company_name?.trim() || slug,
      roleTitle: job.title.trim(),
      location: job.location?.name?.trim() || null,
      jobUrl: job.absolute_url ?? null,
      jobDescription: htmlToText(job.content ?? ""),
      postedAt: job.first_published ? new Date(job.first_published) : null,
    }));
  },
};
