"use client";

import { useActionState, useState } from "react";
import { requestEmailChange, type AccountState } from "@/lib/account/actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmailForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AccountState, FormData>(requestEmailChange, {});
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="newEmail">{t("settings.newEmail")}</Label>
        <Input id="newEmail" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <p className="text-xs text-muted-foreground">{t("settings.emailNote")}</p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-lg border bg-accent/40 p-3 text-sm animate-in fade-in slide-in-from-top-1 duration-300">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" pending={pending} variant="secondary">
          {t("settings.changeEmail")}
        </Button>
      </div>
    </form>
  );
}
