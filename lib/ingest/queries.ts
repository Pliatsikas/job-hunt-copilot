import { requireUser } from "../auth";
import { db } from "../db";

export async function listSavedSearches() {
  const user = await requireUser();
  return db.savedSearch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { leads: { where: { status: "NEW" } } } } },
  });
}

/** The triage queue: NEW leads, scored ones first, newest within that. */
export async function listNewLeads() {
  const user = await requireUser();
  return db.lead.findMany({
    where: { userId: user.id, status: "NEW" },
    orderBy: [{ matchScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function countLeads() {
  const user = await requireUser();
  const [open, dismissed, promoted] = await Promise.all([
    db.lead.count({ where: { userId: user.id, status: "NEW" } }),
    db.lead.count({ where: { userId: user.id, status: "DISMISSED" } }),
    db.lead.count({ where: { userId: user.id, status: "PROMOTED" } }),
  ]);
  return { open, dismissed, promoted };
}
