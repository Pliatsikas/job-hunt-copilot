"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/applications/actions";
import { useT } from "@/lib/i18n/client";
import { STATUSES } from "@/lib/schemas/application";
import { Button } from "@/components/ui/button";
import { SELECT_FOCUS } from "@/components/ui/select-focus";

export function StatusChanger({
  action,
  current,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  current: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          name="status"
          defaultValue={current}
          aria-label={t("application.status")}
          className={"h-9 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm" + SELECT_FOCUS}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`application.statuses.${status}`)}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" pending={pending}>
          {pending ? t("common.saving") : t("application.update")}
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
