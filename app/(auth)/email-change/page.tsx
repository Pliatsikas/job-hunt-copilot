import type { Metadata } from "next";
import Link from "next/link";
import { confirmEmailChange, signOutAfterEmailChange } from "@/lib/account/actions";
import { auth } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Confirm new email" };
export const dynamic = "force-dynamic";

/**
 * The link's landing. Consumed on this render — the change is the one thing
 * the link does. The session's JWT still carries the old address, so the
 * signed-in case ends with a sign-out; the link opened elsewhere just goes
 * to the sign-in page.
 */
export default async function EmailChangePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [t, { token }, session] = await Promise.all([getT(), searchParams, auth()]);
  const result = token ? await confirmEmailChange(token) : ({ ok: false, reason: "invalid" } as const);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>{result.ok ? t("settings.emailChangedTitle") : t("settings.emailTitle")}</h1>
        </CardTitle>
        <CardDescription>
          {result.ok
            ? t("settings.emailChangedSub", { email: result.newEmail })
            : result.reason === "taken"
              ? t("settings.emailChangeTaken")
              : result.reason === "expired"
                ? t("settings.emailChangeExpired")
                : t("settings.emailChangeInvalid")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {result.ok && session?.user ? (
          <form action={signOutAfterEmailChange}>
            <Button type="submit" className="w-full">
              {t("auth.signIn")}
            </Button>
          </form>
        ) : (
          <Link href={session?.user ? "/settings" : "/login"} className={buttonVariants()}>
            {session?.user ? t("nav.settings") : t("auth.signIn")}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
