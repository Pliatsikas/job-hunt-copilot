"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { extractStructuredCv, saveStructuredCv, type CvSaveState, type ExtractState } from "@/lib/cv/actions";
import { useT } from "@/lib/i18n/client";
import type { CvLanguage, StructuredCv } from "@/lib/schemas/structured-cv";
import {
  CertificationsFields,
  ContactsFields,
  EducationFields,
  ExperienceFields,
  IdentityFields,
  InterestsFields,
  LanguagesFields,
  ProjectsFields,
  SkillsFields,
} from "@/components/cv/sections";
import { Button } from "@/components/ui/button";

export function CvEditor({
  initial,
  language,
  hasCvText,
  onChange,
  designJson,
  autoFill = false,
}: {
  initial: StructuredCv;
  language: CvLanguage;
  hasCvText: boolean;
  /** The builder listens here to render the live preview. */
  onChange?: (cv: StructuredCv) => void;
  /** The builder's design choices, saved together with the CV. */
  designJson?: string;
  /** Fire "fill from my CV text" on mount, once — the start screen's second door. */
  autoFill?: boolean;
}) {
  const t = useT();
  const [cv, setCv] = useState<StructuredCv>(initial);
  const [saveState, save, saving] = useActionState<CvSaveState, FormData>(saveStructuredCv, {});
  const [extract, extractAction, extracting] = useActionState<ExtractState, FormData>(extractStructuredCv, {});

  useEffect(() => {
    if (extract.cv) setCv(extract.cv);
  }, [extract.cv]);
  useEffect(() => {
    onChange?.(cv);
  }, [cv, onChange]);
  const extractFormRef = useRef<HTMLFormElement>(null);
  const filledOnce = useRef(false);
  useEffect(() => {
    if (!autoFill || !hasCvText || filledOnce.current) return;
    filledOnce.current = true;
    window.history.replaceState(null, "", window.location.pathname + window.location.search.replace(/[?&]fill=1/, ""));
    extractFormRef.current?.requestSubmit();
  }, [autoFill, hasCvText]);

  const set = <K extends keyof StructuredCv>(key: K, value: StructuredCv[K]) => setCv((c) => ({ ...c, [key]: value }));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-sm text-muted-foreground">{t("cvEditor.fillNote")}</p>
          <form action={extractAction} ref={extractFormRef}>
            <Button type="submit" variant="secondary" pending={extracting} disabled={!hasCvText}>
              {!extracting && <Sparkles className="size-4" aria-hidden />}
              {extracting ? t("cvEditor.filling") : t("cvEditor.fillFromText")}
            </Button>
          </form>
        </div>
        {extract.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {extract.error}
          </p>
        )}
        {extract.cv && (
          <div role="status" className="mt-3 rounded-lg border bg-accent/40 p-3 text-sm animate-in fade-in duration-300">
            <p>{t("cvEditor.filled")}</p>
            {extract.dropped && extract.dropped.length > 0 && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">{t("cvEditor.droppedIntro", { count: extract.dropped.length })}</summary>
                <ul className="mt-1 list-disc pl-5">
                  {extract.dropped.slice(0, 40).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <form action={save} className="flex flex-col gap-6">
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="cv" value={JSON.stringify(cv)} />
        {designJson && <input type="hidden" name="design" value={designJson} />}

        <IdentityFields cv={cv} set={set} />
        <ContactsFields cv={cv} set={set} />
        <SkillsFields cv={cv} set={set} />
        <LanguagesFields cv={cv} set={set} />
        <CertificationsFields cv={cv} set={set} />
        <InterestsFields cv={cv} set={set} />
        <ExperienceFields cv={cv} set={set} />
        <EducationFields cv={cv} set={set} />
        <ProjectsFields cv={cv} set={set} />

        {saveState.error && (
          <p role="alert" className="text-sm text-destructive">
            {saveState.error}
          </p>
        )}
        {saveState.savedAt && !saveState.error && (
          <p role="status" className="text-sm text-muted-foreground animate-in fade-in duration-300">
            {t("cvEditor.saved")}
          </p>
        )}
        <div className="sticky bottom-16 z-10 -mx-4 flex justify-end border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:bottom-0 lg:-mx-8 lg:px-8">
          <Button type="submit" pending={saving} size="lg">
            {t("cvEditor.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}

