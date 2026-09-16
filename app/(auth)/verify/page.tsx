import type { Metadata } from "next";
import Link from "next/link";
import { consumeVerificationToken } from "@/lib/email/verification";
import { getT } from "@/lib/i18n/server";
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
  const [t, { token }] = await Promise.all([getT(), searchParams]);
  const result = token ? await consumeVerificationToken(token) : ({ ok: false, reason: "invalid" } as const);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>{result.ok ? t("auth.confirmed") : result.reason === "expired" ? t("auth.expired") : t("auth.invalid")}</h1>
        </CardTitle>
        <CardDescription>
          {result.ok ? t("auth.confirmedSub") : result.reason === "expired" ? t("auth.expiredSub") : t("auth.invalidSub")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Link href="/login" className={buttonVariants()}>
          {t("auth.signIn")}
        </Link>
        {!result.ok && (
          <Link href="/verify/sent" className={buttonVariants({ variant: "secondary" })}>
            {t("auth.newLink")}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
