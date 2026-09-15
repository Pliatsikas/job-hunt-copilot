import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { email } = await searchParams;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>Check your inbox</h1>
        </CardTitle>
        <CardDescription>
          {email ? (
            <>
              A confirmation link is on its way to <strong>{email}</strong>.
            </>
          ) : (
            "A confirmation link is on its way."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>Open it to finish creating your account. It works for 24 hours.</p>
        <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground">
          <strong className="text-foreground">Not there? Check your spam folder.</strong> The
          email comes from a plain mailbox rather than a domain with its own signing, and some
          providers file that as spam the first time. Marking it &ldquo;not spam&rdquo; fixes it
          for next time.
        </p>
        <ResendForm defaultEmail={email ?? ""} />
        <p className="text-center text-muted-foreground">
          Already confirmed?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
