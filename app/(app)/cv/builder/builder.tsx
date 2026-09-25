"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ExternalLink, Printer } from "lucide-react";
import { saveDesign, type CvSaveState } from "@/lib/cv/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/t";
import { CV_ACCENTS, CV_TEMPLATES, TEMPLATE_HAS_PHOTO, type CvAccent, type CvDesign, type CvTemplate } from "@/lib/schemas/cv-design";
import type { CvLanguage, StructuredCv } from "@/lib/schemas/structured-cv";
import { CvTemplateView } from "@/components/cv/templates";
import { Button, buttonVariants } from "@/components/ui/button";
import { CvEditor } from "@/app/(app)/profile/cv/cv-editor";
import { PhotoForm } from "@/app/(app)/profile/cv/photo-form";

/** The A4 page's CSS size; the preview scales the real page down from this. */
const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;

/**
 * Two panes: the form and the page. The page is the real template component
 * rendered from the form's live state and scaled to the pane — no iframe,
 * no screenshot — so what the owner sees is what prints. Design choices
 * save on their own (one click); the CV saves from the form's own button.
 */
export function Builder({
  initial,
  language,
  hasCvText,
  photo,
  initialDesign,
  autoFill = false,
}: {
  initial: StructuredCv;
  language: CvLanguage;
  hasCvText: boolean;
  photo: string | null;
  initialDesign: CvDesign;
  /** From the start screen's "from my profile text": run the extraction on arrival, once. */
  autoFill?: boolean;
}) {
  const t = useT();
  const [cv, setCv] = useState<StructuredCv>(initial);
  const [design, setDesign] = useState<CvDesign>(initialDesign);
  const [dirty, setDirty] = useState(false);
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [designState, designAction, savingDesign] = useActionState<CvSaveState, FormData>(saveDesign, {});
  const designFormRef = useRef<HTMLFormElement>(null);

  const onChange = useCallback((next: StructuredCv) => {
    setCv(next);
    setDirty(next !== initial);
  }, [initial]);

  // A design change saves itself: it is one click, and nobody wants a
  // "save design" button next to a "save CV" button.
  const firstDesign = useRef(true);
  useEffect(() => {
    if (firstDesign.current) {
      firstDesign.current = false;
      return;
    }
    designFormRef.current?.requestSubmit();
  }, [design]);

  const update = (patch: Partial<CvDesign>) => setDesign((d) => ({ ...d, ...patch }));
  const designJson = JSON.stringify(design);

  return (
    <div className="flex flex-col gap-4">
      <form ref={designFormRef} action={designAction} className="hidden">
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="design" value={designJson} />
      </form>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("builder.template")}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {CV_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    // Coming from a template with no photo slot, the photo comes back on;
                    // between two that have one, the owner's switch is kept.
                    onClick={() =>
                      update({
                        template: tpl,
                        showPhoto: TEMPLATE_HAS_PHOTO[tpl] ? (TEMPLATE_HAS_PHOTO[design.template] ? design.showPhoto : true) : false,
                      })
                    }
                    aria-pressed={design.template === tpl}
                    className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                      design.template === tpl ? "border-primary bg-primary/5" : "hover:bg-accent/40"
                    }`}
                  >
                    <TemplateGlyph template={tpl} accent={CV_ACCENTS[design.accent]} />
                    <span className="min-w-0">
                      <span className="block font-medium">{t(`builder.templates.${tpl}` as MessageKey)}</span>
                      <span className="block text-xs text-muted-foreground">{t(`builder.templateNotes.${tpl}` as MessageKey)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t("builder.accent")}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("builder.accent")}>
                  {(Object.keys(CV_ACCENTS) as CvAccent[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={design.accent === a}
                      aria-label={t(`builder.accents.${a}` as MessageKey)}
                      title={t(`builder.accents.${a}` as MessageKey)}
                      onClick={() => update({ accent: a })}
                      className={`grid size-8 place-items-center rounded-full border-2 transition-transform hover:scale-105 ${design.accent === a ? "border-foreground" : "border-transparent"}`}
                      style={{ background: CV_ACCENTS[a] }}
                    >
                      {design.accent === a && <Check className="size-4 text-white" aria-hidden />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t("builder.photo")}</p>
                {TEMPLATE_HAS_PHOTO[design.template] ? (
                  <div className="inline-flex rounded-full border bg-muted/40 p-0.5">
                    {([true, false] as const).map((on) => (
                      <button
                        key={String(on)}
                        type="button"
                        aria-pressed={design.showPhoto === on}
                        onClick={() => update({ showPhoto: on })}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${design.showPhoto === on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
                      >
                        {on ? t("builder.photoOn") : t("builder.photoOff")}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("builder.noPhotoHere")}</p>
                )}
              </div>

              <div className="text-xs text-muted-foreground" aria-live="polite">
                {savingDesign ? t("common.saving") : designState.savedAt && !designState.error ? t("builder.designSaved") : designState.error ?? ""}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <a href={`/cv/mine/${language}?print=1`} target="_blank" rel="noopener" className={buttonVariants({ size: "lg" })}>
              <Printer className="size-4" aria-hidden />
              {t("builder.download")}
            </a>
            <Link href={`/cv/mine/${language}`} target="_blank" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              <ExternalLink className="mr-1 inline size-3" aria-hidden />
              {t("builder.open")}
            </Link>
            <p className="max-w-56 text-right text-xs text-muted-foreground">{dirty ? t("builder.unsaved") : t("builder.downloadNote")}</p>
          </div>
        </div>
      </section>

      {/* Mobile: one pane at a time. Desktop: both, the page sticky. */}
      <div className="flex gap-2 lg:hidden">
        {(["edit", "preview"] as const).map((p) => (
          <Button key={p} type="button" variant={pane === p ? "default" : "outline"} size="sm" onClick={() => setPane(p)} aria-pressed={pane === p}>
            {p === "edit" ? t("builder.edit") : t("builder.preview")}
          </Button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className={pane === "edit" ? "flex min-w-0 flex-col gap-6" : "hidden min-w-0 lg:flex lg:flex-col lg:gap-6"}>
          {TEMPLATE_HAS_PHOTO[design.template] && design.showPhoto && (
            <section className="rounded-xl border bg-card p-4 sm:p-5">
              <h2 className="mb-3 text-base font-semibold">{t("cvEditor.photo")}</h2>
              <PhotoForm current={photo} />
            </section>
          )}
          <CvEditor initial={initial} language={language} hasCvText={hasCvText} onChange={onChange} designJson={designJson} autoFill={autoFill} />
        </div>

        <div className={pane === "preview" ? "block min-w-0" : "hidden min-w-0 lg:block"}>
          <div className="lg:sticky lg:top-4">
            <ScaledPage pagesLabel={(n) => (n === 1 ? t("builder.onePage") : t("builder.pages", { count: n }))}>
              <CvTemplateView cv={cv} language={language} photo={photo} design={design} embedded />
            </ScaledPage>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the A4 page at its real width and scales it to the container, so
 * the fonts, wrapping and pagination the owner sees are the print's. The
 * wrapper's height follows the scaled page so nothing below overlaps.
 */
function ScaledPage({ children, pagesLabel }: { children: React.ReactNode; pagesLabel: (n: number) => string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [pages, setPages] = useState(1);

  useLayoutEffect(() => {
    const el = outer.current;
    const page = inner.current;
    if (!el || !page) return;
    const measure = () => {
      const s = Math.min(1, el.clientWidth / PAGE_WIDTH_PX);
      setScale(s);
      setHeight(page.offsetHeight * s);
      setPages(Math.max(1, Math.ceil(page.offsetHeight / PAGE_HEIGHT_PX - 0.02)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(page);
    return () => ro.disconnect();
  }, []);

  return (
    <div>
      <p className="mb-2 text-right text-xs text-muted-foreground" aria-live="polite">
        {pagesLabel(pages)}
      </p>
      <div ref={outer} className="relative w-full overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10" style={{ height }}>
        <div ref={inner} style={{ width: PAGE_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
        {/* Where the printer will cut: one dashed line per page boundary. */}
        {Array.from({ length: pages - 1 }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-red-400/70"
            style={{ top: (i + 1) * PAGE_HEIGHT_PX * scale }}
          />
        ))}
      </div>
    </div>
  );
}

/** A 40×52 thumbnail that says which template this is before the name does. */
function TemplateGlyph({ template, accent }: { template: CvTemplate; accent: string }) {
  const bar = (w: string, extra = "") => <div className={`h-1 rounded-sm bg-current opacity-30 ${extra}`} style={{ width: w }} />;
  return (
    <div className="grid h-13 w-10 shrink-0 overflow-hidden rounded-sm border bg-white text-neutral-700" aria-hidden>
      {template === "sidebar" && (
        <div className="grid h-full grid-cols-[38%_1fr]">
          <div style={{ background: "#3e3535" }} />
          <div className="flex flex-col gap-1 p-1 pt-2">
            <div className="h-1.5 w-5 rounded-sm" style={{ background: "#2a2220" }} />
            {bar("70%")}
            {bar("90%")}
            {bar("60%")}
          </div>
        </div>
      )}
      {template === "classic" && (
        <div className="flex h-full flex-col gap-1 p-1 pt-2">
          <div className="h-1.5 w-6 rounded-sm" style={{ background: "#2a2220" }} />
          <div className="h-px w-full" style={{ background: accent }} />
          {bar("90%")}
          {bar("75%")}
          {bar("85%")}
        </div>
      )}
      {template === "modern" && (
        <div className="flex h-full flex-col">
          <div className="h-3.5 w-full" style={{ background: accent }} />
          <div className="grid flex-1 grid-cols-[1fr_38%] gap-1 p-1">
            <div className="flex flex-col gap-1">
              {bar("90%")}
              {bar("70%")}
              {bar("80%")}
            </div>
            <div className="flex flex-col gap-1">
              {bar("100%")}
              {bar("60%")}
            </div>
          </div>
        </div>
      )}
      {template === "minimal" && (
        <div className="flex h-full flex-col gap-1 p-1 pt-2">
          <div className="h-1.5 w-5 rounded-sm" style={{ background: accent }} />
          {bar("100%")}
          {bar("100%")}
          {bar("80%")}
          {bar("100%")}
        </div>
      )}
    </div>
  );
}
