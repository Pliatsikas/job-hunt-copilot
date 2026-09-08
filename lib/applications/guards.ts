import { requireUser } from "../auth";
import { db } from "../db";

/**
 * The only way to reach an application. Filters by id AND the session's
 * userId in a single query, so another user's row is indistinguishable from
 * a row that doesn't exist — never a bare findUnique({ where: { id } }).
 */
export async function requireOwnedApplication(id: string) {
  const user = await requireUser();

  const application = await db.application.findFirst({
    where: { id, userId: user.id },
    include: { company: true },
  });

  if (!application) {
    // Deliberately identical for "missing" and "someone else's" — a distinct
    // message would confirm the row exists to a user who can't see it.
    throw new Error("Application not found");
  }

  return application;
}
