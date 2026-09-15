import { createHash, randomBytes } from "node:crypto";
import { db } from "../db";

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The link carries a random token; the row stores its SHA-256. A copy of the
 * table cannot be turned into working links. Auth.js's VerificationToken
 * model already has the right shape (identifier, token, expires), so it is
 * reused rather than shadowed by a second table.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueVerificationToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  // One live token per address: a resend replaces, so an older link cannot
  // stay valid alongside a newer one.
  await db.verificationToken.deleteMany({ where: { identifier: email } });
  await db.verificationToken.create({
    data: { identifier: email, token: hashToken(token), expires: new Date(Date.now() + VERIFICATION_TTL_MS) },
  });
  return token;
}

export type ConsumeResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Looks the token up, deletes it, marks the account. One use only — the
 * delete happens whether or not the token had expired, so a stale link is
 * gone the moment it is tried.
 */
export async function consumeVerificationToken(token: string): Promise<ConsumeResult> {
  const hashed = hashToken(token);
  const row = await db.verificationToken.findFirst({ where: { token: hashed } });
  if (!row) return { ok: false, reason: "invalid" };

  await db.verificationToken.deleteMany({ where: { identifier: row.identifier, token: hashed } });
  if (row.expires.getTime() < Date.now()) return { ok: false, reason: "expired" };

  await db.user.updateMany({
    where: { email: row.identifier, emailVerified: null },
    data: { emailVerified: new Date() },
  });
  return { ok: true, email: row.identifier };
}

export const UNVERIFIED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * An account that was never verified holds an email address hostage. After a
 * week it is removed so the address can be registered again; nothing else
 * was ever attached to it. Called opportunistically, like the rate-limit
 * prune — there is no cron here.
 */
export async function pruneUnverifiedAccounts(now = new Date()): Promise<number> {
  try {
    const { count } = await db.user.deleteMany({
      where: {
        emailVerified: null,
        passwordHash: { not: null },
        createdAt: { lt: new Date(now.getTime() - UNVERIFIED_MAX_AGE_MS) },
        // Never an account with anything in it — a safety net against a
        // grandfathering mistake, not an expected path.
        applications: { none: {} },
        profile: null,
      },
    });
    return count;
  } catch (error) {
    console.error("Unverified-account prune failed:", error);
    return 0;
  }
}
