import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwnedApplication } from "@/lib/applications/guards";
import { getTailoredCv } from "@/lib/applications/documents";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Tailored CV",
  description: "A print-ready view of a tailored CV. Use the browser's print dialog to save it as PDF.",
};

/**
 * PDF export is the browser's own print-to-PDF over a print stylesheet. No
 * PDF library, no server rendering, no fonts to ship: the document is plain
 * text in sections, and a print stylesheet does that better than any
 * generated layout would.
 */
export default async function TailoredCvPage({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { id, version } = await params;
  const application = await requireOwnedApplication(id);
  const doc = await getTailoredCv(application.id, application.userId, Number(version));
  if (!doc) notFound();
  const t = await getT();

  const sections = doc.content.split("\n\n").map((block) => {
    const [heading, ...lines] = block.split("\n");
    return { heading, lines };
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold">{t("cvPrint.title", { version: doc.version })}</h1>
          <p className="text-sm text-muted-foreground">
            {t("cvPrint.forRole", { role: application.roleTitle })}
            {application.company ? ` · ${application.company.name}` : ""} · {formatDate(doc.createdAt)}. {t("cvPrint.everyLineYours")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link href={`/applications/${application.id}`} className="text-sm underline">
            {t("common.back")}
          </Link>
        </div>
      </div>

      <article className="print-cv text-[13px] leading-relaxed">
        {sections.map((section) => (
          <section key={section.heading} className="mb-5 break-inside-avoid">
            <h2 className="mb-1 border-b border-black/60 pb-0.5 text-[11px] font-semibold tracking-widest uppercase">
              {section.heading}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {section.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </article>
    </div>
  );
}
