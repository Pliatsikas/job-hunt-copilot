"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, signOut } from "../auth";
import { clientIpFrom } from "../client-ip";
import { db } from "../db";
import { getEmailProvider } from "../email";
import { isDisposableEmail } from "../email/disposable";
import { requestOrigin } from "../email/send-verification";
import { emailChangedNoticeEmail, emailChangeEmail, passwordResetEmail } from "../email/templates";
import { env } from "../env";
import { hashPassword, verifyPassword } from "../password";
import { consumeAll, describeRetryAfter } from "../rate-limit";
import { registerSchema } from "../schemas/auth";
import { PASSWORD_NUDGE_COOKIE } from "./nudge";
import { consumeAccountToken, emailChangeIdentifier, issueAccountToken, resetIdentifier } from "./tokens";

export type AccountState = { error?: string; message?: string; done?: boolean };

const HOUR = 60 * 60 * 1000;
const passwordSchema = registerSchema.shape.password;

/* ───────────── password: signed in ───────────── */

/**
 * A signed-in account with no password sets one directly — the session is
 * the proof of ownership, no email round trip. A GitHub-only account has
 * never confirmed its address with us, so the same write marks it verified:
 * GitHub did that check, and without it the new password would be refused
 * at sign-in as "unconfirmed".
 */
export async function setPassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password" };

  const current = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!current) return { error: "Account not found." };
  if (current.passwordHash) return { error: "This account already has a password — change it with the current one." };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data), emailVerified: new Date() },
  });
  return { done: true };
}

export async function changePassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  const currentPassword = String(formData.get("currentPassword") ?? "");

  const current = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!current?.passwordHash) return { error: "This account has no password yet." };
  if (!(await verifyPassword(currentPassword, current.passwordHash))) {
    // Priced like a sign-in attempt: the current-password check is one.
    return { error: "The current password is wrong." };
  }

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data) } });
  return { done: true };
}

/* ───────────── password: forgotten ───────────── */

/**
 * Says the same thing for every address — registered, not, GitHub-only — so
 * the form cannot be used to find out which emails have accounts. Limited
 * per address and per IP: the mail is the cost here, not the query.
 */
export async function requestPasswordReset(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { error: "Enter the email you signed up with." };

  const ip = clientIpFrom(await headers());
  const verdict = await consumeAll([
    { key: `reset:${email}`, rule: { windowMs: HOUR, max: 3 } },
    { key: `reset-ip:${ip}`, rule: { windowMs: HOUR, max: 10 } },
  ]);
  if (!verdict.allowed) {
    return { error: `Too many requests. Try again ${describeRetryAfter(verdict.retryAfterMs)}.` };
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    try {
      const token = await issueAccountToken(resetIdentifier(email));
      const link = `${await requestOrigin()}/reset?token=${encodeURIComponent(token)}`;
      await getEmailProvider().send(passwordResetEmail({ to: email, link, productName: env.EMAIL_FROM_NAME }));
    } catch (error) {
      console.error("Password reset email failed:", error);
      return { error: "The email could not be sent right now. Try again in a minute." };
    }
  }
  return { message: "If that address has an account, a link to set a new password is on its way. Check spam too." };
}

/**
 * The link's form. The token is consumed on submit, not on the page view, so
 * a mail client that prefetches links does not burn it; a wrong password
 * rule keeps the token alive (nothing was consumed yet).
 */
export async function resetPassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const token = String(formData.get("token") ?? "");
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password" };

  const consumed = await consumeAccountToken(token, "reset");
  if (!consumed.ok) {
    return { error: consumed.reason === "expired" ? "That link has expired. Request a new one." : "That link is not valid. Request a new one." };
  }

  const updated = await db.user.updateMany({
    where: { email: consumed.email },
    // The link reached the inbox, which is what verification proves.
    data: { passwordHash: await hashPassword(parsed.data), emailVerified: new Date() },
  });
  if (updated.count === 0) return { error: "That link is not valid. Request a new one." };
  redirect("/login?reset=1");
}

/* ───────────── email change ───────────── */

/**
 * The new address gets the link; the old one stays in force until it is
 * opened. Nothing is written to the User row here — only a token whose
 * identifier remembers which account and which address.
 */
export async function requestEmailChange(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser();
  const newEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(newEmail).success) return { error: "Enter a valid email address." };
  if (isDisposableEmail(newEmail)) return { error: "That looks like a disposable email address. Use one you will keep." };

  const me = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (!me) return { error: "Account not found." };
  if (me.email === newEmail) return { error: "That is already your email." };

  const verdict = await consumeAll([{ key: `email-change:${user.id}`, rule: { windowMs: HOUR, max: 3 } }]);
  if (!verdict.allowed) return { error: `Too many requests. Try again ${describeRetryAfter(verdict.retryAfterMs)}.` };

  // "Taken" is not revealed: the reply is the same, and the taken address
  // simply never gets a link that would work.
  const taken = await db.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (!taken) {
    try {
      const token = await issueAccountToken(emailChangeIdentifier(user.id, newEmail));
      const link = `${await requestOrigin()}/email-change?token=${encodeURIComponent(token)}`;
      await getEmailProvider().send(emailChangeEmail({ to: newEmail, link, productName: env.EMAIL_FROM_NAME }));
    } catch (error) {
      console.error("Email change mail failed:", error);
      return { error: "The email could not be sent right now. Try again in a minute." };
    }
  }
  return { message: `A confirmation link is on its way to ${newEmail}. Your current address keeps working until you open it.` };
}

export type EmailChangeResult = { ok: true; newEmail: string } | { ok: false; reason: "invalid" | "expired" | "taken" };

/** The link's landing. Consumed on view — the change is the one thing the link does. */
export async function confirmEmailChange(token: string): Promise<EmailChangeResult> {
  const consumed = await consumeAccountToken(token, "email-change");
  if (!consumed.ok) return { ok: false, reason: consumed.reason };

  const user = await db.user.findUnique({ where: { id: consumed.userId }, select: { email: true } });
  if (!user) return { ok: false, reason: "invalid" };
  const taken = await db.user.findUnique({ where: { email: consumed.newEmail }, select: { id: true } });
  if (taken) return { ok: false, reason: "taken" };

  await db.user.update({
    where: { id: consumed.userId },
    data: { email: consumed.newEmail, emailVerified: new Date() },
  });
  try {
    await getEmailProvider().send(
      emailChangedNoticeEmail({ to: user.email, newEmail: consumed.newEmail, productName: env.EMAIL_FROM_NAME }),
    );
  } catch (error) {
    // The change is done; the courtesy notice failing must not undo it.
    console.error("Email-changed notice failed:", error);
  }
  return { ok: true, newEmail: consumed.newEmail };
}

/* ───────────── the first-GitHub-sign-in nudge ───────────── */


/** "Later" on the nudge: quiet for 30 days in this browser. */
export async function dismissPasswordNudge(): Promise<void> {
  await requireUser();
  (await cookies()).set(PASSWORD_NUDGE_COOKIE, "1", { maxAge: 30 * 24 * 60 * 60, sameSite: "lax", path: "/" });
}

/** After an email change the JWT still carries the old address: start over. */
export async function signOutAfterEmailChange(): Promise<void> {
  await signOut({ redirectTo: "/login?emailChanged=1" });
}
