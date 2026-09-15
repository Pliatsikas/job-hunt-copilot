"use client";

import { useActionState } from "react";
import type { TailorState } from "@/lib/applications/tailor";
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
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending || !hasAnalysis} className="w-full">
        {pending ? "Tailoring…" : hasPrevious ? "Tailor CV again" : "Tailor CV to this posting"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {hasAnalysis
          ? "Reorders and selects lines from your CV for this posting. Nothing is rewritten: every line is yours, character for character, or it is left out."
          : "Run the analysis first — the tailored CV is ordered around its keywords."}
      </p>

      {pending && (
        <p role="status" className="text-xs text-muted-foreground">
          Choosing and ordering your CV&apos;s lines against the posting, then checking every one
          of them against the original.
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      {state.version && (
        <p role="status" className="text-sm">
          Saved as Tailored CV v{state.version}
          {state.coverage !== undefined && ` · uses ${Math.round(state.coverage * 100)}% of your CV's lines`}
          {state.keywordsAddressed?.length
            ? ` · covers: ${state.keywordsAddressed.join(", ")}`
            : ""}
        </p>
      )}

      {state.droppedLines && state.droppedLines.length > 0 && (
        <details className="rounded-lg border border-destructive/40 p-3 text-xs">
          <summary className="cursor-pointer">
            {state.droppedLines.length} line{state.droppedLines.length === 1 ? "" : "s"} the
            model altered were left out
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {state.droppedLines.map((line, i) => (
              <li key={i} className="line-through">
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            These were not your CV&apos;s own lines, so they were discarded rather than saved
            as if they were.
          </p>
        </details>
      )}
    </form>
  );
}
