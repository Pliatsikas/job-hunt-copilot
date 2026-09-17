import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "New password" };

/**
 * The token is only read here and handed to the form; it is consumed when
 * the form submits, so opening the link (or a mail client prefetching it)
 * costs nothing.
 */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [t, { token }] = await Promise.all([getT(), searchParams]);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>{t("settings.resetTitle")}</h1>
        </CardTitle>
        <CardDescription>{t("settings.resetSub")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {token ? (
          <ResetForm token={token} />
        ) : (
          <>
            <p className="text-sm text-destructive">{t("settings.emailChangeInvalid")}</p>
            <Link href="/forgot" className={buttonVariants({ variant: "secondary" })}>
              {t("auth.newLink")}
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
