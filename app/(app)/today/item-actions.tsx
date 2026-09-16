"use client";

import { useActionState } from "react";
import type { ReminderState } from "@/lib/applications/reminders";
import { SNOOZE_DAYS } from "@/lib/applications/follow-up-policy";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "ghost",
}: {
  action: (state: ReminderState, formData: FormData) => Promise<ReminderState>;
  label: string;
  pendingLabel: string;
  variant?: "ghost" | "secondary";
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant={variant} pending={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error && (
        <span role="alert" className="ml-2 text-xs text-destructive">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function ItemActions({
  snooze,
  markDone,
}: {
  snooze: (state: ReminderState, formData: FormData) => Promise<ReminderState>;
  markDone: (state: ReminderState, formData: FormData) => Promise<ReminderState>;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-1">
      <ActionButton action={markDone} label={t("today.markDone")} pendingLabel={t("common.saving")} variant="secondary" />
      <ActionButton action={snooze} label={t("today.snooze", { days: SNOOZE_DAYS })} pendingLabel={t("common.saving")} />
    </div>
  );
}
