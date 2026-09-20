import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStructuredCv } from "@/lib/cv/queries";
import { CV_LANGUAGES, EMPTY_CV, type CvLanguage } from "@/lib/schemas/structured-cv";
import { Page } from "@/components/page";
import { WIZARD_STEPS } from "@/lib/cv/wizard-steps";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "New CV" };
export const dynamic = "force-dynamic";

/**
 * The guided CV: `?step=1..7`, one section each. The CV so far is read on
 * every step so a return after days picks up where it stopped; the wizard
 * is keyed on language + step so each screen starts from what is saved.
 */
export default async function NewCvPage({ searchParams }: { searchParams: Promise<{ lang?: string; step?: string; fresh?: string }> }) {
  const { lang, step: rawStep, fresh } = await searchParams;
  const language: CvLanguage = CV_LANGUAGES.includes(lang as CvLanguage) ? (lang as CvLanguage) : "en";
  const n = Number(rawStep ?? "1");
  if (!Number.isInteger(n) || n < 1 || n > WIZARD_STEPS.length) notFound();
  const step = WIZARD_STEPS[n - 1];
  // "Start again from scratch": the first screen opens empty; its save replaces the old CV.
  const cv = n === 1 && fresh === "1" ? null : await getStructuredCv(language);

  return (
    <Page>
      <Wizard key={`${language}-${step}`} initial={cv ?? EMPTY_CV} language={language} step={step} />
    </Page>
  );
}
