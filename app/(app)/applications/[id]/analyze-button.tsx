"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import type { AnalyzeState } from "@/lib/applications/analyze";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export function AnalyzeButton({
  action,
  hasPrevious,
  size = "default",
}: {
  action: (state: AnalyzeState, formData: FormData) => Promise<AnalyzeState>;
  hasPrevious: boolean;
  size?: "default" | "lg" | "sm";
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} size={size} variant={hasPrevious ? "secondary" : "default"}>
        {!hasPrevious && <Sparkles className="size-4" aria-hidden />}
        {pending ? t("application.analysing") : hasPrevious ? t("application.analyseAgain") : t("application.analyse")}
      </Button>

      {pending && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("application.analysingNote")}
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
