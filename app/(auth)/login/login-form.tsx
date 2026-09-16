"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginUser, type LoginState } from "@/lib/login";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export function LoginForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState(loginUser, initialState);
  // Controlled, so a wrong password does not also wipe the email — React 19
  // resets uncontrolled fields when the action returns.
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
          {state.unverifiedEmail && (
            <>
              {" "}
              <Link
                href={`/verify/sent?email=${encodeURIComponent(state.unverifiedEmail)}`}
                className="underline"
              >
                {t("auth.resendLink")}
              </Link>
            </>
          )}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </Button>
    </form>
  );
}
