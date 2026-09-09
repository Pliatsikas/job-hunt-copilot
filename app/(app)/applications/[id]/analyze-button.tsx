"use client";

import { useActionState } from "react";
import type { AnalyzeState } from "@/lib/applications/analyze";
import { Button } from "@/components/ui/button";

export function AnalyzeButton({
  action,
  hasPrevious,
}: {
  action: (state: AnalyzeState, formData: FormData) => Promise<AnalyzeState>;
  hasPrevious: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? "Analyzing…"
          : hasPrevious
            ? "Run analysis again"
            : "Analyze against my CV"}
      </Button>

      {pending && (
        <p role="status" className="text-xs text-muted-foreground">
          Comparing the posting against your CV. This takes a few seconds — the result is
          validated before anything is saved.
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
