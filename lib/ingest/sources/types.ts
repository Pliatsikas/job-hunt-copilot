import type { LeadSource } from "@prisma/client";

/** What every source adapter produces, whatever the API's own shape. */
export type NormalizedJob = {
  externalId: string;
  companyName: string;
  roleTitle: string;
  location: string | null;
  jobUrl: string | null;
  /** Plain text, already through htmlToText. */
  jobDescription: string;
  postedAt: Date | null;
};

export type SourceAdapter = {
  source: LeadSource;
  label: string;
  /** What the query means for this source, shown as the input's help text. */
  queryHint: string;
  /**
   * The only host this adapter may fetch from. Enforced by the fetch wrapper,
   * not by convention: CLAUDE.md #4 forbids fetching job-board URLs, and the
   * exception SPEC.md §6.4 carves out is for documented public APIs — so the
   * set of hosts is a list, not a pattern.
   */
  host: string;
  fetchJobs(query: string): Promise<NormalizedJob[]>;
};

export class SourceError extends Error {
  constructor(
    public readonly source: LeadSource,
    message: string,
  ) {
    super(message);
    this.name = "SourceError";
  }
}
