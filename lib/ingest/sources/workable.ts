import { htmlToText } from "../html-to-text";
import { cleanQuery, fetchJson } from "./fetch";
import type { NormalizedJob, SourceAdapter } from "./types";

type WorkableJob = {
  shortcode: string;
  title: string;
  url?: string;
  description?: string;
  city?: string;
  country?: string;
  telecommuting?: boolean;
  published_on?: string;
};

/**
 * Workable's public job-board widget API, documented per employer:
 * https://apply.workable.com/api/v1/widget/accounts/{subdomain}. Workable
 * is Greek-founded and the default ATS of the Greek tech market, which makes
 * this the one source that reliably carries Athens and Thessaloniki postings
 * with full descriptions — the thing Jooble's Greek index turned out not to
 * have. `details=true` returns the description body.
 */
export const workable: SourceAdapter = {
  source: "WORKABLE",
  label: "Workable board",
  queryHint: "The employer's Workable subdomain — the part after apply.workable.com/ (e.g. skroutz).",
  host: "apply.workable.com",

  async fetchJobs(query: string): Promise<NormalizedJob[]> {
    const slug = cleanQuery(query).replace(/\s+/g, "");
    const data = await fetchJson<{ name?: string; jobs?: WorkableJob[] }>(
      "WORKABLE",
      this.host,
      `https://${this.host}/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`,
    );
    const company = data.name?.trim() || slug;
    return (data.jobs ?? []).map((job) => ({
      externalId: job.shortcode,
      companyName: company,
      roleTitle: job.title.trim(),
      location: [job.city, job.country].filter(Boolean).join(", ") || (job.telecommuting ? "Remote" : null),
      jobUrl: job.url ?? null,
      jobDescription: htmlToText(job.description ?? ""),
      postedAt: job.published_on ? new Date(job.published_on) : null,
      remote: job.telecommuting ?? null,
    }));
  },
};
