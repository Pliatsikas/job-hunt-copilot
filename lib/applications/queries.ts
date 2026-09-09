import type { Prisma } from "@prisma/client";
import { requireUser } from "../auth";
import { db } from "../db";
import type { ApplicationFilters } from "../schemas/application";

const ORDER_BY: Record<ApplicationFilters["sort"], keyof Prisma.ApplicationOrderByWithRelationInput> =
  {
    created: "createdAt",
    applied: "appliedAt",
    nextAction: "nextActionAt",
    role: "roleTitle",
  };

// Prisma only accepts the { sort, nulls } form on nullable columns; the others
// take a bare SortOrder. Sorting by a date most rows haven't set yet is the
// common case, so those get nulls last rather than crowding the top.
const NULLABLE_SORTS = new Set<ApplicationFilters["sort"]>(["applied", "nextAction"]);

function buildOrderBy(filters: ApplicationFilters): Prisma.ApplicationOrderByWithRelationInput {
  const field = ORDER_BY[filters.sort];
  return NULLABLE_SORTS.has(filters.sort)
    ? { [field]: { sort: filters.dir, nulls: "last" } }
    : { [field]: filters.dir };
}

/** Filtering and sorting happen in Postgres, not in JS over a full table read. */
export async function listApplications(filters: ApplicationFilters) {
  const user = await requireUser();

  const where: Prisma.ApplicationWhereInput = {
    userId: user.id,
    archivedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.company ? { companyId: filters.company } : {}),
    ...(filters.q
      ? {
          OR: [
            { roleTitle: { contains: filters.q, mode: "insensitive" } },
            { jobDescription: { contains: filters.q, mode: "insensitive" } },
            { location: { contains: filters.q, mode: "insensitive" } },
            { company: { name: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  return db.application.findMany({
    where,
    include: { company: { select: { id: true, name: true } } },
    orderBy: [buildOrderBy(filters)],
  });
}

/** Companies that actually have applications, for the filter dropdown. */
export async function listCompaniesForFilter() {
  const user = await requireUser();

  return db.company.findMany({
    where: { userId: user.id, applications: { some: { archivedAt: null } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function countApplications() {
  const user = await requireUser();
  return db.application.count({ where: { userId: user.id, archivedAt: null } });
}

/** Timeline for the detail page — newest first. */
export async function listEvents(applicationId: string) {
  const user = await requireUser();

  // Filtered by userId AND applicationId, per SPEC.md §8 Α1.
  return db.event.findMany({
    where: { applicationId, userId: user.id },
    orderBy: { at: "desc" },
  });
}

/** Analyses for one application, newest first — previous runs stay reachable. */
export async function listAnalyses(applicationId: string) {
  const user = await requireUser();

  // Filtered by userId AND applicationId, per SPEC.md §8 Α1.
  return db.analysis.findMany({
    where: { applicationId, userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}
