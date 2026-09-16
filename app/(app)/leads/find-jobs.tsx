"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { findJobsNow, type IngestState } from "@/lib/ingest/actions";
import { Button } from "@/components/ui/button";

export function FindJobsButton({ ready }: { ready: boolean }) {
  const [state, action, pending] = useActionState<IngestState, FormData>(findJobsNow, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <Button type="submit" disabled={pending || !ready}>
        <Search className="size-4" aria-hidden />
        {pending ? "Searching…" : "Find jobs now"}
      </Button>
      {pending && (
        <p role="status" className="text-xs text-muted-foreground">
          Reading every watched board and ranking against your preferences — no model calls.
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
