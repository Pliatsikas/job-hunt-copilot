import { requireUser } from "../auth";
import { db } from "../db";

/** What the settings page and the nudge need: the address and whether a password exists. */
export async function getAccount() {
  const user = await requireUser();
  const row = await db.user.findUnique({ where: { id: user.id }, select: { email: true, passwordHash: true } });
  if (!row) throw new Error("Unauthorized");
  return { email: row.email, hasPassword: Boolean(row.passwordHash) };
}
