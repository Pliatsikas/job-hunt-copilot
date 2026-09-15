import type { LeadSource } from "@prisma/client";
import { arbeitnow } from "./arbeitnow";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { remotive } from "./remotive";
import type { SourceAdapter } from "./types";

/**
 * Every source, in SPEC.md §6.4's priority order: company board APIs first,
 * then free job APIs. Adding one means an enum value, a migration and an
 * adapter here — a string that appeared from nowhere cannot be a source.
 */
export const SOURCES: Record<LeadSource, SourceAdapter> = {
  GREENHOUSE: greenhouse,
  LEVER: lever,
  ARBEITNOW: arbeitnow,
  REMOTIVE: remotive,
};

export const SOURCE_LIST = Object.values(SOURCES);
