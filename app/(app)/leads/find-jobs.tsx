"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { findJobsNow, type IngestState } from "@/lib/ingest/actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export function FindJobsButton({ ready }: { ready: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<IngestState, FormData>(findJobsNow, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <Button type="submit" disabled={pending || !ready}>
        <Search className="size-4" aria-hidden />
        {pending ? t("jobs.finding") : t("jobs.find")}
      </Button>
      {pending && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("jobs.findingNote")}
        </p>
      )}
      {state.message && !pending && (
        <p role="status" className="max-w-md text-right text-xs text-muted-foreground">
          {state.message}
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
