"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { TailorState } from "@/lib/applications/tailor";
import { useLocale, useT } from "@/lib/i18n/client";
import type { CvLanguage } from "@/lib/schemas/structured-cv";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SELECT_FOCUS } from "@/components/ui/select-focus";

export function TailorButton({
  action,
  hasAnalysis,
  hasPrevious,
  applicationId,
  cvLanguages,
}: {
  action: (state: TailorState, formData: FormData) => Promise<TailorState>;
  hasAnalysis: boolean;
  hasPrevious: boolean;
  applicationId: string;
  /** Languages with a structured CV — the designed document is possible in these. */
  cvLanguages: CvLanguage[];
}) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, {});
  const designed = cvLanguages.length > 0;
  const [language, setLanguage] = useState<CvLanguage>(cvLanguages.includes(locale) ? locale : (cvLanguages[0] ?? "en"));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {designed ? t("application.cvDesignedNote") : t("application.cvTextNote")}
        {!designed && (
          <>
            {" "}
            <Link href="/profile/cv" className="underline underline-offset-4">
              {t("application.setUpCv")}
            </Link>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {designed && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cv-language">{t("application.cvLanguage")}</Label>
            <select
              id="cv-language"
              name="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as CvLanguage)}
              className={"h-8 rounded-lg border border-border bg-background px-2.5 text-sm" + SELECT_FOCUS}
            >
              {cvLanguages.map((l) => (
                <option key={l} value={l}>
                  {t(`profile.languageOptions.${l}`)}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button type="submit" pending={pending} disabled={!hasAnalysis} variant={hasPrevious ? "secondary" : "default"}>
          {pending ? t("application.tailoring") : hasPrevious ? t("application.tailorAgain") : t("application.makeCv")}
        </Button>
      </div>
      {!hasAnalysis && <p className="text-xs text-muted-foreground">{t("application.tailorNeedsAnalysis")}</p>}

      {pending && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("application.tailoringNote")}
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      {state.version && (
        <div className="flex flex-wrap items-center gap-3 animate-in fade-in duration-300">
          <p role="status" className="text-sm">
            {t("application.savedAsCv", { version: state.version })}
            {state.coverage !== undefined && ` · ${t("application.usesLines", { percent: Math.round(state.coverage * 100) })}`}
            {state.keywordsAddressed?.length ? ` · ${t("application.covers", { keywords: state.keywordsAddressed.join(", ") })}` : ""}
          </p>
          <Link href={`/cv/${applicationId}/${state.version}`} target="_blank" className={buttonVariants({ size: "sm", variant: "secondary" })}>
            <ExternalLink className="size-4" aria-hidden />
            {t("application.openCv")}
          </Link>
        </div>
      )}

      {state.kind === "text" && state.droppedLines && state.droppedLines.length > 0 && (
        <details className="rounded-lg border border-destructive/40 p-3 text-xs">
          <summary className="cursor-pointer">{t("application.linesAltered", { count: state.droppedLines.length })}</summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {state.droppedLines.map((line, i) => (
              <li key={i} className="line-through">
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-2">{t("application.linesAlteredNote")}</p>
        </details>
      )}
    </form>
  );
}
