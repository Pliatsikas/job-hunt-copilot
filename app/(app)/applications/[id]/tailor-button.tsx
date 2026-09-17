"use client";

import { useActionState } from "react";
import type { TailorState } from "@/lib/applications/tailor";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export function TailorButton({
  action,
  hasAnalysis,
  hasPrevious,
}: {
  action: (state: TailorState, formData: FormData) => Promise<TailorState>;
  hasAnalysis: boolean;
  hasPrevious: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" pending={pending} disabled={!hasAnalysis} variant={hasPrevious ? "secondary" : "default"}>
        {pending ? t("application.tailoring") : hasPrevious ? t("application.tailorAgain") : t("application.makeCv")}
      </Button>
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
        <p role="status" className="text-sm">
          {t("application.savedAsCv", { version: state.version })}
          {state.coverage !== undefined && ` · ${t("application.usesLines", { percent: Math.round(state.coverage * 100) })}`}
          {state.keywordsAddressed?.length ? ` · ${t("application.covers", { keywords: state.keywordsAddressed.join(", ") })}` : ""}
        </p>
      )}

      {state.droppedLines && state.droppedLines.length > 0 && (
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
