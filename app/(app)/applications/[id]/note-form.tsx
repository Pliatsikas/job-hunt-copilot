"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/applications/actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NoteForm({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box once a note has actually been saved, so it doesn't look
  // like the note failed to post.
  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <Textarea name="body" rows={3} required placeholder={t("application.notePlaceholder")} aria-label={t("application.addNote")} />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" size="sm" pending={pending}>
          {pending ? t("application.adding") : t("application.addNote")}
        </Button>
      </div>
    </form>
  );
}
