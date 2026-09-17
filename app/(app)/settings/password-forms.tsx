"use client";

import { useActionState, useState } from "react";
import { changePassword, setPassword, type AccountState } from "@/lib/account/actions";
import { useT } from "@/lib/i18n/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordChecklist } from "@/app/(auth)/register/password-checklist";

/**
 * One form, two shapes: an account without a password sets one (the session
 * is the proof), an account with one must give the current one first. The
 * checklist is the sign-up one, so the rules read the same everywhere.
 */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<AccountState, FormData>(hasPassword ? changePassword : setPassword, {});
  const [password, setPasswordValue] = useState("");

  if (state.done) {
    return (
      <p role="status" className="text-sm animate-in fade-in duration-300">
        {hasPassword ? t("settings.passwordChanged") : t("settings.passwordSet")}
      </p>
    );
  }

  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      {hasPassword && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="currentPassword">{t("settings.currentPassword")}</Label>
          <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
        </div>
      )}
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
          onChange={(e) => setPasswordValue(e.target.value)}
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
      <div>
        <Button type="submit" pending={pending}>
          {hasPassword ? t("settings.changePassword") : t("settings.setPassword")}
        </Button>
      </div>
    </form>
  );
}
