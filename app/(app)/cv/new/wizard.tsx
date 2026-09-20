"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import { saveStructuredCv, type CvSaveState } from "@/lib/cv/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/t";
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
  type SectionProps,
} from "@/components/cv/sections";
import { Button, buttonVariants } from "@/components/ui/button";

import { WIZARD_STEPS, type WizardStep } from "@/lib/cv/wizard-steps";

const FIELDS: Record<WizardStep, (props: SectionProps) => React.JSX.Element> = {
  identity: IdentityFields,
  contacts: ContactsFields,
  experience: ExperienceFields,
  education: EducationFields,
  skills: SkillsFields,
  projects: ProjectsFields,
  extras: (props) => <ExtrasFields {...props} />,
};

function ExtrasFields(props: SectionProps) {
  const t = useT();
  return (
    <div className="flex flex-col gap-8">
      {(
        [
          ["cvEditor.languages", LanguagesFields],
          ["cvEditor.certifications", CertificationsFields],
          ["cvEditor.interests", InterestsFields],
        ] as const
      ).map(([label, Fields]) => (
        <div key={label} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t(label)}</h2>
          <Fields {...props} bare />
        </div>
      ))}
    </div>
  );
}

/**
 * One section per screen, with a reason and a tip above the fields. Every
 * "Continue" saves the whole CV (the same action the editor uses) and moves
 * to the next step's URL, so a half-done CV survives a closed tab and the
 * back button works. The last step lands on the builder.
 */
export function Wizard({ initial, language, step }: { initial: StructuredCv; language: CvLanguage; step: WizardStep }) {
  const t = useT();
  const router = useRouter();
  const [cv, setCv] = useState<StructuredCv>(initial);
  const [state, save, saving] = useActionState<CvSaveState, FormData>(saveStructuredCv, {});
  const index = WIZARD_STEPS.indexOf(step);
  const last = index === WIZARD_STEPS.length - 1;
  const next = last ? `/cv/builder?lang=${language}` : `/cv/new?lang=${language}&step=${index + 2}`;
  const prev = index === 0 ? `/cv?start=1&lang=${language}` : `/cv/new?lang=${language}&step=${index}`;

  // The save that succeeded is the one that moves on; a failed one stays
  // here with its message, and nothing was lost from the form.
  const lastSaved = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.savedAt && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      router.push(next);
    }
  }, [state.savedAt, next, router]);

  const set = <K extends keyof StructuredCv>(key: K, value: StructuredCv[K]) => setCv((c) => ({ ...c, [key]: value }));
  const Fields = FIELDS[step];
  const k = (leaf: string) => `wizard.steps.${step}.${leaf}` as MessageKey;
  const example = t(k("example"));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-label={t("wizard.stepOf", { step: index + 1, total: WIZARD_STEPS.length })}>
        {WIZARD_STEPS.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-border"}`} aria-hidden />
        ))}
        <span className="shrink-0">{t("wizard.stepOf", { step: index + 1, total: WIZARD_STEPS.length })}</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t(k("title"))}</h1>
        <p className="mt-1 text-muted-foreground">{t(k("why"))}</p>
      </div>

      <div className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div>
          <p>{t(k("tip"))}</p>
          {example && example !== k("example") && <p className="mt-2 text-muted-foreground">{example}</p>}
        </div>
      </div>

      <form action={save} className="flex flex-col gap-6">
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="cv" value={JSON.stringify(cv)} />
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <Fields cv={cv} set={set} bare />
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={prev} className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft className="size-4" aria-hidden />
            {t("wizard.back")}
          </Link>
          <div className="flex items-center gap-3">
            {index > 0 && !last && (
              <Link href={next} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                {t("wizard.skip")}
              </Link>
            )}
            <Button type="submit" pending={saving} size="lg">
              {last ? t("wizard.finish") : t("wizard.continue")}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
