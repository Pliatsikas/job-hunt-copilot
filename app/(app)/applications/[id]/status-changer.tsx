"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/applications/actions";
import { STATUSES } from "@/lib/schemas/application";
import { STATUS_LABELS } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

export function StatusChanger({
  action,
  current,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  current: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          name="status"
          defaultValue={current}
          aria-label="Status"
          className="h-9 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm"
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Update"}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
