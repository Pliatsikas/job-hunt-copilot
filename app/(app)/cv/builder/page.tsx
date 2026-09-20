import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getDesignFor, getPhoto, getStructuredCv } from "@/lib/cv/queries";
import { getT } from "@/lib/i18n/server";
import { getProfile } from "@/lib/profile/get";
import { CV_LANGUAGES, EMPTY_CV, type CvLanguage } from "@/lib/schemas/structured-cv";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { LanguagePills } from "@/components/cv/language-pills";
import { Builder } from "./builder";

export const metadata: Metadata = { title: "CV builder" };
export const dynamic = "force-dynamic";

/**
 * The builder (T10): design choices, the editor and a live page, one CV
 * language at a time. Keyed on the language so switching tabs never carries
 * half-typed Greek into the English form.
 */
export default async function BuilderPage({ searchParams }: { searchParams: Promise<{ lang?: string; fill?: string }> }) {
  const [t, user, { lang, fill }] = await Promise.all([getT(), requireUser(), searchParams]);
  const language: CvLanguage = CV_LANGUAGES.includes(lang as CvLanguage) ? (lang as CvLanguage) : "en";
  const [cv, photo, profile, design] = await Promise.all([
    getStructuredCv(language),
    getPhoto(user.id),
    getProfile(),
    getDesignFor(user.id, language),
  ]);

  return (
    <Page wide>
      <PageHeader
        title={t("builder.title")}
        description={t("builder.sub")}
        actions={<LanguagePills current={language} base="/cv/builder?lang=" label={t("cvEditor.language")} />}
      />
      <Builder key={language} initial={cv ?? EMPTY_CV} language={language} hasCvText={Boolean(profile?.cvText.trim())} photo={photo} initialDesign={design} autoFill={fill === "1"} />
    </Page>
  );
}
