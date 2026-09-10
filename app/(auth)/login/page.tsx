import type { Metadata } from "next";
import Link from "next/link";
import { githubEnabled, signIn } from "@/lib/auth";
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
  const { registered } = await searchParams;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        {/* CardTitle renders a div, so the h1 goes inside it: without this the
            page has no heading at all, and Tailwind's reset means it inherits
            the card's type scale rather than fighting it. */}
        <CardTitle>
          <h1>Sign in</h1>
        </CardTitle>
        <CardDescription>
          {registered ? "Account created — sign in below." : "Welcome back."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LoginForm />
        {githubEnabled && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: "/today" });
              }}
            >
              <Button type="submit" variant="outline" className="w-full">
                Continue with GitHub
              </Button>
            </form>
          </>
        )}
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/register" className="underline underline-offset-4">
            Register
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
