import { env } from "../env";
import { createBrevoProvider } from "./providers/brevo";
import { createLogProvider } from "./providers/log";
import type { EmailProvider } from "./types";

/**
 * Brevo when configured, the console otherwise. The console fallback is
 * deliberate rather than an error: registration must work in every
 * environment, and "no key" should mean "no mail leaves", not "no sign-ups".
 * Production has the key; the boot log says which one is active.
 */
let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  if (env.BREVO_API_KEY && env.EMAIL_FROM) {
    cached = createBrevoProvider(env.BREVO_API_KEY, {
      email: env.EMAIL_FROM,
      name: env.EMAIL_FROM_NAME,
    });
  } else {
    console.info("Email: BREVO_API_KEY not set — verification links go to the server log.");
    cached = createLogProvider();
  }
  return cached;
}

export { EmailError } from "./types";
