import { headers } from "next/headers";
import { getEmailProvider } from "./index";
import { verificationEmail } from "./templates";
import { issueVerificationToken } from "./verification";
import { env } from "../env";

/**
 * The link points at the host the request came in on, so a preview
 * deployment sends preview links and production sends production links —
 * one hard-coded origin would break the first one and the owner's
 * verify-on-preview workflow with it. Vercel sets x-forwarded-host and
 * -proto; locally there is only host.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendVerificationEmail(email: string): Promise<void> {
  const token = await issueVerificationToken(email);
  const link = `${await requestOrigin()}/verify?token=${encodeURIComponent(token)}`;
  await getEmailProvider().send(
    verificationEmail({ to: email, link, productName: env.EMAIL_FROM_NAME }),
  );
}
