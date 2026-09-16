"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
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
  const t = useT();
  useEffect(() => {
    console.error("Unhandled error boundary:", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{t("errors.brokeTitle")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("errors.brokeSub")}
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {t("errors.reference", { digest: error.digest })}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>{t("errors.tryAgain")}</Button>
          <Link href="/today" className={buttonVariants({ variant: "secondary" })}>
            {t("errors.goToday")}
          </Link>
        </div>
      </div>
    </main>
  );
}
