import type { Metadata } from "next";
import Link from "next/link";
import { consumeVerificationToken } from "@/lib/email/verification";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Finishing your account setup.",
};

export const dynamic = "force-dynamic";

/**
 * The link's landing page. The token is consumed on this render — one use,
 * gone whether it succeeded or had expired — so a second click of the same
 * link lands on the "already used" branch rather than an error page. Mail
 * clients that prefetch links would consume it before the person clicks,
 * which is why the outcome page still offers sign-in on every branch: a
 * prefetched-and-consumed token has already verified the account.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await consumeVerificationToken(token) : ({ ok: false, reason: "invalid" } as const);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>{result.ok ? "Email confirmed" : result.reason === "expired" ? "That link has expired" : "That link is not valid"}</h1>
        </CardTitle>
        <CardDescription>
          {result.ok
            ? "Your account is ready. Sign in to get started."
            : result.reason === "expired"
              ? "Links work for 24 hours. Request a new one and try again."
              : "It may already have been used — if you clicked it before, your email is confirmed and you can sign in. Otherwise request a new link."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Link href="/login" className={buttonVariants()}>
          Sign in
        </Link>
        {!result.ok && (
          <Link href="/verify/sent" className={buttonVariants({ variant: "secondary" })}>
            Send a new link
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
