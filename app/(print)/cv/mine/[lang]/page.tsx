import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDesignFor, getPhoto, getStructuredCvFor } from "@/lib/cv/queries";
import { getT } from "@/lib/i18n/server";
import { CV_LANGUAGES, type CvLanguage } from "@/lib/schemas/structured-cv";
import { CvTemplateView } from "@/components/cv/templates";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "../../[id]/[version]/print-button";
import { AutoPrint } from "./auto-print";

export const metadata: Metadata = { title: "CV", description: "Your CV, in your design, ready to print or save as PDF." };
export const dynamic = "force-dynamic";

/** The owner's own CV (not tailored to a role) in the design they chose. */
export default async function MyCvPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const [{ lang }, { print }, t, user] = await Promise.all([params, searchParams, getT(), requireUser()]);
  if (!CV_LANGUAGES.includes(lang as CvLanguage)) notFound();
  const language = lang as CvLanguage;
  const [cv, photo, design] = await Promise.all([getStructuredCvFor(user.id, language), getPhoto(user.id), getDesignFor(user.id, language)]);
  if (!cv) notFound();

  return (
    <div className="min-h-full bg-[#ccc3bf] print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 0; } html, body { background: white; } }`}</style>
      {print === "1" && <AutoPrint />}
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-4 print:hidden">
        <p className="text-sm font-semibold">{cv.name}</p>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link href={`/cv/builder?lang=${language}`} className={buttonVariants({ variant: "secondary" })}>
            {t("common.back")}
          </Link>
        </div>
      </div>
      <div className="flex justify-center px-2 pb-8 print:p-0">
        <CvTemplateView cv={cv} language={language} photo={photo} design={design} />
      </div>
    </div>
  );
}
