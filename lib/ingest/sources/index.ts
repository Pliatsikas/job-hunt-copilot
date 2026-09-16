import type { LeadSource } from "@prisma/client";
import { arbeitnow } from "./arbeitnow";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { remotive } from "./remotive";
import { workable } from "./workable";
import type { SourceAdapter } from "./types";

/**
 * Every source, in SPEC.md §6.4's priority order: company board APIs first,
 * then free job APIs. Adding one means an enum value, a migration and an
 * adapter here — a string that appeared from nowhere cannot be a source.
 */
export const SOURCES: Record<Exclude<LeadSource, "BOOKMARKLET">, SourceAdapter> = {
  GREENHOUSE: greenhouse,
  LEVER: lever,
  WORKABLE: workable,
  ARBEITNOW: arbeitnow,
  REMOTIVE: remotive,
};

/** Sources that read one employer's board by slug. */
export const EMPLOYER_SOURCES = ["WORKABLE", "GREENHOUSE", "LEVER"] as const;
/** Sources that search by keyword. Queried from preferences, never user-managed. */
export const KEYWORD_SOURCES = ["REMOTIVE", "ARBEITNOW"] as const;

export const SOURCE_LIST = Object.values(SOURCES);
