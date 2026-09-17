"use client";

import { useActionState, useState } from "react";
import { resetPassword, type AccountState } from "@/lib/account/actions";
import { useT } from "@/lib/i18n/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordChecklist } from "@/app/(auth)/register/password-checklist";

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<AccountState, FormData>(resetPassword, {});
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("settings.newPassword")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          aria-describedby="password-rules"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div id="password-rules">
          <PasswordChecklist password={password} />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" pending={pending} className="w-full">
        {t("settings.resetButton")}
      </Button>
    </form>
  );
}
