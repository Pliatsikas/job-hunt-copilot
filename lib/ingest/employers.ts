import type { LeadSource } from "@prisma/client";

export type WatchedEmployer = {
  source: Extract<LeadSource, "WORKABLE" | "GREENHOUSE" | "LEVER">;
  slug: string;
  name: string;
  /** Postings located in Greece on the day the board was checked. */
  greekJobs: number;
  checkedOn: string;
};

/**
 * Greek tech employers whose boards have a public API, each verified live on
 * the date shown — not from memory, and not from a list someone published.
 * The counts are there so a board that has gone quiet is visible rather than
 * silent: an entry that reads "49 on 2026-09-16" and returns 0 next spring is
 * a prompt to check whether they moved ATS.
 *
 * This is a starting point. The owner can watch any employer by slug from the
 * Leads page; nothing here is special beyond having been checked once.
 */
export const CURATED_EMPLOYERS: readonly WatchedEmployer[] = [
  { source: "GREENHOUSE", slug: "kaizengaming", name: "Kaizen Gaming", greekJobs: 49, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "agileactors", name: "Agile Actors", greekJobs: 28, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "spotawheel", name: "Spotawheel", greekJobs: 25, checkedOn: "2026-09-16" },
  { source: "GREENHOUSE", slug: "elastic", name: "Elastic", greekJobs: 22, checkedOn: "2026-09-16" },
  { source: "GREENHOUSE", slug: "wolt", name: "Wolt", greekJobs: 21, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "viva", name: "Viva.com", greekJobs: 17, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "skroutz", name: "Skroutz", greekJobs: 13, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "welcomepickups", name: "Welcome Pickups", greekJobs: 10, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "upstream", name: "Upstream", greekJobs: 8, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "epignosis", name: "Epignosis", greekJobs: 7, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "blueground", name: "Blueground", greekJobs: 5, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "atcom", name: "Atcom", greekJobs: 5, checkedOn: "2026-09-16" },
  { source: "WORKABLE", slug: "orfium", name: "Orfium", greekJobs: 1, checkedOn: "2026-09-16" },
];
