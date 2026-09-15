"use server";

import { db } from "../db";
import { consumeAll, describeRetryAfter } from "../rate-limit";
import { sendVerificationEmail } from "./send-verification";

export type ResendState = { error?: string; message?: string };

const HOUR = 60 * 60 * 1000;

/**
 * Sends a fresh link to an unverified account. Says the same thing whether
 * the address is registered, unregistered, or already verified — the resend
 * form must not become an oracle for which emails have accounts, the same
 * rule the login form follows.
 */
export async function resendVerification(_prev: ResendState, formData: FormData): Promise<ResendState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter the email you signed up with." };

  const verdict = await consumeAll([{ key: `resend:${email}`, rule: { windowMs: HOUR, max: 3 } }]);
  if (!verdict.allowed) {
    return { error: `Too many resends for this address. Try again ${describeRetryAfter(verdict.retryAfterMs)}.` };
  }

  const user = await db.user.findUnique({ where: { email }, select: { emailVerified: true, passwordHash: true } });
  if (user && !user.emailVerified && user.passwordHash) {
    try {
      await sendVerificationEmail(email);
    } catch (error) {
      console.error("Resend failed:", error);
      return { error: "The email could not be sent right now. Try again in a minute." };
    }
  }

  return { message: "If that address has an unverified account, a new link is on its way. Check spam too." };
}
