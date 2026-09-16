import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-xl font-semibold">{t("errors.notFoundTitle")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("errors.notFoundSub")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/today" className={buttonVariants()}>
            {t("errors.goToday")}
          </Link>
          <Link href="/applications" className={buttonVariants({ variant: "secondary" })}>
            {t("errors.allApplications")}
          </Link>
        </div>
      </div>
    </main>
  );
}
