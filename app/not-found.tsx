import Link from "next/link";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-xl font-semibold">That page isn&apos;t here</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The link may be out of date, or the application it pointed at may have been deleted.
          Nothing has gone wrong with your data.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/today" className={buttonVariants()}>
            Go to Today
          </Link>
          <Link href="/applications" className={buttonVariants({ variant: "secondary" })}>
            All applications
          </Link>
        </div>
      </div>
    </main>
  );
}
