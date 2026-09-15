"use client";

import { useActionState, useState } from "react";
import { registerUser, type RegisterState } from "@/lib/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-rules";
import { PasswordChecklist } from "./password-checklist";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerUser, initialState);
  // Both fields are controlled. React 19 resets uncontrolled inputs when a
  // form action completes, so after "Password needs: an uppercase letter" the
  // email the user had typed vanished and the next submit tripped the
  // browser's "please fill out this field". Found by the end-to-end test.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
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
        <Label htmlFor="password">Password</Label>
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
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Register"}
      </Button>
    </form>
  );
}
