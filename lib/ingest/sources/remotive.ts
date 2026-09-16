import { htmlToText } from "../html-to-text";
import { cleanQuery, fetchJson } from "./fetch";
import type { NormalizedJob, SourceAdapter } from "./types";

type RemotiveJob = {
  id: number;
  title: string;
  company_name: string;
  url?: string;
  description?: string;
  candidate_required_location?: string;
  publication_date?: string;
};

/**
 * Remotive public API — https://remotive.com/api/remote-jobs, free and
 * documented for personal, non-commercial use, which this is.
 */
export const remotive: SourceAdapter = {
  source: "REMOTIVE",
  label: "Remotive (remote jobs)",
  queryHint: "A search term, e.g. react or node.",
  host: "remotive.com",

  async fetchJobs(query: string): Promise<NormalizedJob[]> {
    const q = cleanQuery(query);
    const data = await fetchJson<{ jobs?: RemotiveJob[] }>(
      "REMOTIVE",
      this.host,
      `https://${this.host}/api/remote-jobs?search=${encodeURIComponent(q)}&limit=50`,
    );
    return (data.jobs ?? []).map((job) => ({
      externalId: String(job.id),
      companyName: job.company_name.trim(),
      roleTitle: job.title.trim(),
      location: job.candidate_required_location?.trim() || "Remote",
      jobUrl: job.url ?? null,
      jobDescription: htmlToText(job.description ?? ""),
      postedAt: job.publication_date ? new Date(job.publication_date) : null,
      // Every Remotive posting is remote by definition of the board.
      remote: true,
    }));
  },
};
