"use client";

import { useActionState, useState } from "react";
import { requestPasswordReset, type AccountState } from "@/lib/account/actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AccountState, FormData>(requestPasswordReset, {});
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm animate-in fade-in duration-300">
          {state.message}
        </p>
      )}
      <Button type="submit" pending={pending} className="w-full">
        {t("settings.sendLink")}
      </Button>
    </form>
  );
}
