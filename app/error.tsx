"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * The last resort for an unhandled render error. It says what is and is not
 * affected, because the useful thing to know here is whether your data
 * survived — not what threw. The digest is shown so a report can be matched
 * to a server log line; the message itself is deliberately not rendered, since
 * it can carry internals.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error boundary:", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something broke on this page</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your applications, analyses and saved documents are unaffected — nothing is written
          unless it completed. Try again, and if it keeps happening, move on to another page
          and come back.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Link href="/today" className={buttonVariants({ variant: "secondary" })}>
            Go to Today
          </Link>
        </div>
      </div>
    </main>
  );
}
