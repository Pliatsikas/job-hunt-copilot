import type { Metadata } from "next";
import Link from "next/link";
import { githubEnabled, signIn } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Job Hunt Copilot.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const [t, { registered }] = await Promise.all([getT(), searchParams]);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        {/* CardTitle renders a div, so the h1 goes inside it: without this the
            page has no heading at all, and Tailwind's reset means it inherits
            the card's type scale rather than fighting it. */}
        <CardTitle>
          <h1>{t("auth.signInTitle")}</h1>
        </CardTitle>
        <CardDescription>
          {registered ? t("auth.accountCreated") : t("auth.signInSub")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LoginForm />
        {githubEnabled && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("auth.or")}
              <span className="h-px flex-1 bg-border" />
            </div>
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: "/today" });
              }}
            >
              <Button type="submit" variant="outline" className="w-full">
                {t("auth.github")}
              </Button>
            </form>
          </>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="underline underline-offset-4">
            {t("auth.register")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
