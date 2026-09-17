import { randomBytes } from "node:crypto";
import { db } from "../db";
import { hashToken } from "../email/verification";

export const ACCOUNT_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Two more link-by-email flows share the VerificationToken table with T02's
 * sign-up confirmation: the identifier carries the purpose, so a reset link
 * can never confirm an address and vice versa. Same properties as before —
 * the row holds a SHA-256, one live token per identifier, one use, and a
 * shorter life (an hour: these links act on an existing account).
 *
 *   reset:<email>                          — set a new password
 *   email-change:<userId>:<new email>      — move the account to a new address
 */
export type AccountTokenPurpose = "reset" | "email-change";

export function resetIdentifier(email: string): string {
  return `reset:${email}`;
}
export function emailChangeIdentifier(userId: string, newEmail: string): string {
  return `email-change:${userId}:${newEmail}`;
}

export async function issueAccountToken(identifier: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.verificationToken.deleteMany({ where: { identifier } });
  await db.verificationToken.create({
    data: { identifier, token: hashToken(token), expires: new Date(Date.now() + ACCOUNT_TOKEN_TTL_MS) },
  });
  return token;
}

export type ConsumedAccountToken =
  | { ok: true; purpose: "reset"; email: string }
  | { ok: true; purpose: "email-change"; userId: string; newEmail: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Deletes the row whether or not it had expired, then reads the purpose off
 * the identifier. `expected` guards the caller: a reset page handed an
 * email-change token gets "invalid", not a surprise.
 */
export async function consumeAccountToken<P extends AccountTokenPurpose>(
  token: string,
  expected: P,
): Promise<Extract<ConsumedAccountToken, { ok: false }> | Extract<ConsumedAccountToken, { purpose: P }>> {
  const hashed = hashToken(token);
  const row = await db.verificationToken.findFirst({ where: { token: hashed } });
  if (!row) return { ok: false, reason: "invalid" };
  await db.verificationToken.deleteMany({ where: { identifier: row.identifier, token: hashed } });
  if (row.expires.getTime() < Date.now()) return { ok: false, reason: "expired" };

  const parsed = parseIdentifier(row.identifier);
  if (!parsed || parsed.purpose !== expected) return { ok: false, reason: "invalid" };
  return parsed as Extract<ConsumedAccountToken, { purpose: P }>;
}

export function parseIdentifier(identifier: string): Extract<ConsumedAccountToken, { ok: true }> | null {
  if (identifier.startsWith("reset:")) {
    const email = identifier.slice("reset:".length);
    return email ? { ok: true, purpose: "reset", email } : null;
  }
  if (identifier.startsWith("email-change:")) {
    const rest = identifier.slice("email-change:".length);
    const at = rest.indexOf(":");
    if (at <= 0) return null;
    const userId = rest.slice(0, at);
    const newEmail = rest.slice(at + 1);
    return newEmail ? { ok: true, purpose: "email-change", userId, newEmail } : null;
  }
  return null;
}
