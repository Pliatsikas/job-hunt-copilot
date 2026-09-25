"use server";

import { AuthError } from "next-auth";
import { signIn } from "./auth";
import { env } from "./env";

/**
 * The demo account's credentials are public — they are in the README, in
 * `prisma/seed.ts`, and on the login page. This server action is a shortcut
 * for what any visitor can already type by hand, so the landing page's "Try
 * the demo" is one click instead of a copy-paste.
 *
 * It is still a form action, not a link: a GET that signs you in would fire
 * on a prefetch or a crawler. The sign-in goes through the same
 * `authorize()` as the login form, so the per-IP login limit applies
 * unchanged. `ALLOW_DEMO_LOGIN` must be "true" — a self-hosted copy with no
 * demo account cannot be walked into.
 */
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo12345";

export async function signInAsDemo(): Promise<void> {
  if (env.ALLOW_DEMO_LOGIN !== "true") return;
  try {
    await signIn("credentials", { email: DEMO_EMAIL, password: DEMO_PASSWORD, redirectTo: "/today" });
  } catch (error) {
    // A redirect is how a successful signIn() reports itself; anything else
    // (the account is missing, the limit tripped) lands the visitor on the
    // login page, where the credentials are printed anyway.
    if (error instanceof AuthError) return;
    throw error;
  }
}
