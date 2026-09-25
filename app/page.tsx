import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, Briefcase, FileText, Inbox, PenLine, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { signInAsDemo } from "@/lib/demo";
import { env } from "@/lib/env";
import { getLocale, getT } from "@/lib/i18n/server";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { Button, buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Job Hunt Copilot — does this job actually match you?",
};
export const dynamic = "force-dynamic";

const REPO = "https://github.com/Pliatsikas/job-hunt-copilot";

/**
 * The public landing page (T11). Everything else needs a session; this is
 * the one page a recruiter, or anyone the owner sends the link to, can open.
 * A signed-in visitor never sees it — they go straight to Today.
 */
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/today");
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const demo = env.ALLOW_DEMO_LOGIN === "true";

  const features = [
    { key: "analyse", icon: BadgeCheck },
    { key: "write", icon: PenLine },
    { key: "cv", icon: FileText },
    { key: "jobs", icon: Inbox },
    { key: "track", icon: Briefcase },
    { key: "honest", icon: ShieldCheck },
  ] as const;

  const shots = [
    { key: "today", src: "/shots/today.png" },
    { key: "analysis", src: "/shots/analysis.png" },
    { key: "builder", src: "/shots/builder.png" },
  ] as const;

  // The root layout already provides the messages; this page only reads them.
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">J</span>
          Job Hunt Copilot
        </span>
        <div className="flex items-center gap-3">
          <LanguageSwitch current={locale} label={t("nav.language")} />
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("landing.signIn")}
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-4 pt-8 pb-12 sm:px-6 sm:pt-14">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t("landing.tagline")}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{t("landing.lead")}</p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {demo && (
            <form action={signInAsDemo}>
              <Button type="submit" size="lg">
                {t("landing.tryDemo")}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </form>
          )}
          <Link href="/register" className={buttonVariants({ variant: "secondary", size: "lg" })}>
            {t("landing.register")}
          </Link>
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t("landing.source")}
          </a>
        </div>
        {demo && <p className="mt-3 text-sm text-muted-foreground">{t("landing.tryDemoNote")}</p>}
      </section>

      <section className="border-y bg-card/40">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
          {shots.map(({ key, src }) => (
            <figure key={key} className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
                <Image src={src} alt={t(`landing.shots.${key}`)} width={1280} height={800} className="h-auto w-full" priority />
              </div>
              <figcaption className="text-sm text-muted-foreground">{t(`landing.shots.${key}`)}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">{t("landing.featuresTitle")}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ key, icon: Icon }) => (
            <div key={key} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
              <Icon className="size-5 text-primary" aria-hidden />
              <h3 className="font-medium">{t(`landing.features.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(`landing.features.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="text-lg font-semibold">{t("landing.stackTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t("landing.stack")}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {demo && (
              <form action={signInAsDemo}>
                <Button type="submit">
                  {t("landing.tryDemo")}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </form>
            )}
            <a href={REPO} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
              {t("landing.source")}
            </a>
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-muted-foreground sm:px-6">{t("landing.footer")}</footer>
    </main>
  );
}
