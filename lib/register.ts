"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkRegisterLimit, registerLimitMessage } from "./auth-limits";
import { db } from "./db";
import { isDisposableEmail } from "./email/disposable";
import { sendVerificationEmail } from "./email/send-verification";
import { EmailError } from "./email/types";
import { pruneUnverifiedAccounts } from "./email/verification";
import { hashPassword } from "./password";
import { registerSchema } from "./schemas/auth";

export type RegisterState = { error?: string };

export async function registerUser(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;

  // Consumed after validation but before the lookup: an "already exists" reply
  // is itself an email-enumeration oracle, so a blocked caller must not get
  // one either.
  const verdict = await checkRegisterLimit(await headers());
  if (!verdict.allowed) {
    return { error: registerLimitMessage(verdict) };
  }

  // Refused before anything is sent: a throwaway inbox is still an inbox and
  // the link would work, so this is the one net that has to come first.
  if (isDisposableEmail(email)) {
    return { error: "That looks like a disposable email address. Use one you will keep — the sign-up link goes there." };
  }

  // Accounts that never verified free their address after a week.
  void pruneUnverifiedAccounts();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists" };
  }

  const passwordHash = await hashPassword(password);
  // The row exists before the email is verified, so the address is reserved
  // and the resend flow has something to resend to; authorize() refuses it
  // until emailVerified is set.
  await db.user.create({ data: { email, passwordHash } });

  try {
    await sendVerificationEmail(email);
  } catch (error) {
    // The account exists; the mail did not go. Say so, and point at resend
    // rather than leaving the person to register again into "already exists".
    console.error("Verification email failed:", error);
    const detail = error instanceof EmailError ? error.message : "";
    return {
      error: `Your account was created but the confirmation email could not be sent. ${detail} Use "resend" on the next page.`.replace("  ", " "),
    };
  }

  redirect(`/verify/sent?email=${encodeURIComponent(email)}`);
}
