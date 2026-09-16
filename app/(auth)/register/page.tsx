import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a Job Hunt Copilot account.",
};

export default async function RegisterPage() {
  const t = await getT();
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>{t("auth.registerTitle")}</h1>
        </CardTitle>
        <CardDescription>{t("auth.registerSub")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="underline underline-offset-4">
            {t("auth.signIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
