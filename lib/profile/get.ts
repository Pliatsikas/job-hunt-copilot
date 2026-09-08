import { requireUser } from "../auth";
import { db } from "../db";

/** The session user's profile, or null if they haven't filled one in yet. */
export async function getProfile() {
  const user = await requireUser();

  return db.profile.findUnique({ where: { userId: user.id } });
}
