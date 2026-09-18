import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPhoto, getStructuredCv } from "@/lib/cv/queries";
import { getT } from "@/lib/i18n/server";
import { getProfile } from "@/lib/profile/get";
import { CV_LANGUAGES, EMPTY_CV, type CvLanguage } from "@/lib/schemas/structured-cv";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { CvEditor } from "./cv-editor";
import { PhotoForm } from "./photo-form";

export const metadata: Metadata = { title: "Your CV" };
export const dynamic = "force-dynamic";

/**
 * The structured CV, one language at a time (`?lang=el|en`). The editor is
 * keyed on the language so switching tabs never carries half-typed Greek
 * into the English form.
 */
export default async function CvPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const [t, user, { lang }] = await Promise.all([getT(), requireUser(), searchParams]);
  const language: CvLanguage = CV_LANGUAGES.includes(lang as CvLanguage) ? (lang as CvLanguage) : "en";
  const [cv, photo, profile] = await Promise.all([getStructuredCv(language), getPhoto(user.id), getProfile()]);

  return (
    <Page>
      <PageHeader title={t("cvEditor.title")} description={t("cvEditor.sub")} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">{t("cvEditor.language")}</span>
        <div className="inline-flex rounded-full border bg-muted/40 p-0.5" role="group" aria-label={t("cvEditor.language")}>
          {CV_LANGUAGES.map((l) => (
            <Link
              key={l}
              href={`/profile/cv?lang=${l}`}
              aria-current={l === language ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium ${l === language ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {l === "el" ? "ΕΛ" : "EN"}
            </Link>
          ))}
        </div>
      </div>

      <section className="mb-6 rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold">{t("cvEditor.photo")}</h2>
        <PhotoForm current={photo} />
      </section>

      <CvEditor key={language} initial={cv ?? EMPTY_CV} language={language} hasCvText={Boolean(profile?.cvText.trim())} />
    </Page>
  );
}
