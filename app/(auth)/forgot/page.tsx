import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPage() {
  const t = await getT();
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>{t("settings.forgotTitle")}</h1>
        </CardTitle>
        <CardDescription>{t("settings.forgotSub")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ForgotForm />
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4">
            {t("settings.backToSignIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
