import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { availableCvLanguages } from "@/lib/cv/queries";
import { getLocale, getT } from "@/lib/i18n/server";
import { getProfile } from "@/lib/profile/get";
import { CV_LANGUAGES, type CvLanguage } from "@/lib/schemas/structured-cv";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { LanguagePills } from "@/components/cv/language-pills";

export const metadata: Metadata = { title: "CV" };
export const dynamic = "force-dynamic";

/**
 * The CV section's front door. A language that already has a CV goes
 * straight to the builder; one that has none gets the choice: build it from
 * scratch with the guide, or have the profile's text sorted into the form.
 */
export default async function CvHome({ searchParams }: { searchParams: Promise<{ lang?: string; start?: string }> }) {
  const [t, user, locale, { lang, start }] = await Promise.all([getT(), requireUser(), getLocale(), searchParams]);
  const language: CvLanguage = CV_LANGUAGES.includes(lang as CvLanguage) ? (lang as CvLanguage) : locale;
  const ready = await availableCvLanguages(user.id);
  if (ready.includes(language) && start !== "1") redirect(`/cv/builder?lang=${language}`);
  const profile = await getProfile();
  const hasText = Boolean(profile?.cvText.trim());

  return (
    <Page>
      <PageHeader
        title={t("wizard.startTitle")}
        description={t("wizard.startSub")}
        actions={<LanguagePills current={language} base="/cv?start=1&lang=" label={t("cvEditor.language")} />}
      />
      {ready.includes(language) && (
        <p className="mb-4 rounded-lg border bg-accent/40 p-3 text-sm">
          {t("wizard.existing")}{" "}
          <Link href={`/cv/builder?lang=${language}`} className="underline underline-offset-4">
            {t("wizard.openBuilder")}
          </Link>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`/cv/new?lang=${language}&step=1${ready.includes(language) ? "&fresh=1" : ""}`}
          className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-card p-5 transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <FileText className="size-6 text-primary" aria-hidden />
          <div>
            <p className="text-base font-semibold">{ready.includes(language) ? t("wizard.restart") : t("wizard.startScratch")}</p>
            <p className="text-sm text-muted-foreground">{ready.includes(language) ? t("wizard.restartWarn") : t("wizard.startScratchSub")}</p>
          </div>
          <span className={buttonVariants({ size: "sm" })}>{t("wizard.continue")}</span>
        </Link>
        <div className={`flex flex-col gap-3 rounded-xl border bg-card p-5 ${hasText ? "" : "opacity-70"}`}>
          <Sparkles className="size-6 text-primary" aria-hidden />
          <div>
            <p className="text-base font-semibold">{t("wizard.startFromText")}</p>
            <p className="text-sm text-muted-foreground">{hasText ? t("wizard.startFromTextSub") : t("wizard.startFromTextNeeds")}</p>
          </div>
          {hasText ? (
            <Link href={`/cv/builder?lang=${language}&fill=1`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
              {t("cvEditor.fillFromText")}
            </Link>
          ) : (
            <Link href="/profile" className={buttonVariants({ size: "sm", variant: "secondary" })}>
              {t("nav.profile")}
            </Link>
          )}
        </div>
      </div>
    </Page>
  );
}
