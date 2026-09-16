"use client";

import { useActionState, useState } from "react";
import { resendVerification, type ResendState } from "@/lib/email/resend";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResendForm({ defaultEmail }: { defaultEmail: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ResendState, FormData>(resendVerification, {});
  const [email, setEmail] = useState(defaultEmail);

  return (
    <form action={action} className="flex flex-col gap-2 border-t pt-4">
      <Label htmlFor="resend-email">{t("auth.resendLabel")}</Label>
      <div className="flex gap-2">
        <Input
          id="resend-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" variant="secondary" pending={pending}>
          {pending ? t("auth.sending") : t("auth.resend")}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-muted-foreground">
          {state.message}
        </p>
      )}
    </form>
  );
}
