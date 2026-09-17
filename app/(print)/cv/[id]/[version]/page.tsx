import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwnedApplication } from "@/lib/applications/guards";
import { getTailoredCv } from "@/lib/applications/documents";
import { getPhoto } from "@/lib/cv/queries";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { CV_LANGUAGES, structuredCvSchema, type CvLanguage } from "@/lib/schemas/structured-cv";
import { CvChanges } from "@/components/cv/changes";
import { DesignedCv } from "@/components/cv/designed-cv";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "CV",
  description: "A print-ready view of a tailored CV. Use the browser's print dialog to save it as PDF.",
};
export const dynamic = "force-dynamic";

/**
 * PDF export is the browser's own print-to-PDF over a stylesheet. No PDF
 * library, no server rendering, no fonts to ship. Two documents can land
 * here: a designed one (T09, built from the structured CV and stored as
 * `data`) and the older plain-text one (sections of lines); both print.
 */
export default async function TailoredCvPage({ params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version } = await params;
  const application = await requireOwnedApplication(id).catch(() => null);
  if (!application) notFound();
  const doc = await getTailoredCv(application.id, application.userId, Number(version));
  if (!doc) notFound();
  const t = await getT();

  const designed = readDesigned(doc.data);
  const photo = designed ? await getPhoto(application.userId) : null;

  return (
    <div className="min-h-full bg-[#ccc3bf] print:bg-white">
      {/* Overrides globals.css's 18mm page margin: the designed page is the sheet. */}
      <style>{`@media print { @page { size: A4; margin: 0; } html, body { background: white; } }`}</style>
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-4 print:hidden">
        <div className="text-sm">
          {/* The designed page's h1 is the name; the plain one has no other heading. */}
          {designed ? (
            <p className="font-semibold">{t("cvPrint.title", { version: doc.version })}</p>
          ) : (
            <h1 className="font-semibold">{t("cvPrint.title", { version: doc.version })}</h1>
          )}
          <p className="text-[#5a4f4c]">
            {t("cvPrint.forRole", { role: application.roleTitle })}
            {application.company ? ` · ${application.company.name}` : ""} · {formatDate(doc.createdAt)}. {t("cvPrint.everyLineYours")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link href={`/applications/${application.id}`} className={buttonVariants({ variant: "secondary" })}>
            {t("common.back")}
          </Link>
        </div>
      </div>

      {designed ? (
        <>
          <div className="mx-auto max-w-[210mm] px-4 pb-4 print:hidden">
            <h2 className="mb-2 text-sm font-semibold">{t("application.whatChanged")}</h2>
            <CvChanges changes={designed.changes} rejected={designed.rejected} t={t} />
          </div>
          <div className="flex justify-center px-2 pb-8 print:p-0">
            <DesignedCv cv={designed.cv} language={designed.language} photo={photo} />
          </div>
        </>
      ) : (
        <PlainCv content={doc.content} />
      )}
    </div>
  );
}

type Designed = {
  cv: ReturnType<typeof structuredCvSchema.parse>;
  language: CvLanguage;
  changes: { id: string; from: string; to: string }[];
  rejected: { id: string; text: string; reason: string }[];
};

function readDesigned(data: unknown): Designed | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { source?: string; language?: string; cv?: unknown; changes?: unknown; rejected?: unknown };
  if (d.source !== "structured") return null;
  const cv = structuredCvSchema.safeParse(d.cv);
  if (!cv.success) return null;
  const language = CV_LANGUAGES.includes(d.language as CvLanguage) ? (d.language as CvLanguage) : "en";
  return {
    cv: cv.data,
    language,
    changes: Array.isArray(d.changes) ? (d.changes as Designed["changes"]) : [],
    rejected: Array.isArray(d.rejected) ? (d.rejected as Designed["rejected"]) : [],
  };
}

/** The pre-T09 document: headings and lines, one column. */
function PlainCv({ content }: { content: string }) {
  const sections = content.split("\n\n").map((block) => {
    const [heading, ...lines] = block.split("\n");
    return { heading, lines };
  });
  return (
    <article className="mx-auto max-w-3xl bg-white px-8 py-8 text-[13px] leading-relaxed text-black print:max-w-none print:px-0 print:py-0">
      {sections.map((section) => (
        <section key={section.heading} className="mb-5 break-inside-avoid">
          <h2 className="mb-1 border-b border-black/60 pb-0.5 text-[11px] font-semibold tracking-widest uppercase">{section.heading}</h2>
          <ul className="flex flex-col gap-0.5">
            {section.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
