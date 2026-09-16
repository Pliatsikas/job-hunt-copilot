import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = {
  title: "Check your inbox",
  description: "A confirmation link is on its way.",
};

export default async function VerificationSentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const [t, { email }] = await Promise.all([getT(), searchParams]);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>{t("auth.checkInbox")}</h1>
        </CardTitle>
        <CardDescription>
          {email ? (
            <>
              {t("auth.linkOnWay")} <strong>{email}</strong>.
            </>
          ) : (
            t("auth.linkOnWayPlain")
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>{t("auth.openIt")}</p>
        <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground">
          <strong className="text-foreground">{t("auth.spamTitle")}</strong> {t("auth.spamNote")}
        </p>
        <ResendForm defaultEmail={email ?? ""} />
        <p className="text-center text-muted-foreground">
          {t("auth.alreadyConfirmed")}{" "}
          <Link href="/login" className="underline underline-offset-4">
            {t("auth.signIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
