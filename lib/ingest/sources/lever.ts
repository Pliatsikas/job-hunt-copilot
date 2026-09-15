import { htmlToText } from "../html-to-text";
import { cleanQuery, fetchJson } from "./fetch";
import { SourceError, type NormalizedJob, type SourceAdapter } from "./types";

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl?: string;
  descriptionPlain?: string;
  description?: string;
  createdAt?: number;
  categories?: { location?: string; team?: string };
};

/**
 * Lever Postings API — public, documented:
 * https://github.com/lever/postings-api. Unknown slugs answer
 * `{ ok: false, error }` rather than 404, so that shape is checked.
 *
 * Written to the documented format; not verified against a live board at
 * the time of writing, because the slugs tried had moved off Lever. Said
 * here rather than discovered by the first user.
 */
export const lever: SourceAdapter = {
  source: "LEVER",
  label: "Lever board",
  queryHint: "The company's Lever slug — the part after jobs.lever.co/.",
  host: "api.lever.co",

  async fetchJobs(query: string): Promise<NormalizedJob[]> {
    const slug = cleanQuery(query).replace(/\s+/g, "");
    const data = await fetchJson<LeverPosting[] | { ok: false; error?: string }>(
      "LEVER",
      this.host,
      `https://${this.host}/v0/postings/${encodeURIComponent(slug)}?mode=json`,
    );
    if (!Array.isArray(data)) {
      throw new SourceError("LEVER", `Lever has no board "${slug}": ${data.error ?? "not found"}.`);
    }
    return data.map((p) => ({
      externalId: p.id,
      companyName: slug,
      roleTitle: p.text.trim(),
      location: p.categories?.location?.trim() || null,
      jobUrl: p.hostedUrl ?? null,
      jobDescription: p.descriptionPlain?.trim() || htmlToText(p.description ?? ""),
      postedAt: p.createdAt ? new Date(p.createdAt) : null,
    }));
  },
};
