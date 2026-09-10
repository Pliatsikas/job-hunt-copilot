"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkRegisterLimit, registerLimitMessage } from "./auth-limits";
import { db } from "./db";
import { hashPassword } from "./password";
import { registerSchema } from "./schemas/auth";

export type RegisterState = { error?: string };

export async function registerUser(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;

  // Consumed after validation but before the lookup: an "already exists" reply
  // is itself an email-enumeration oracle, so a blocked caller must not get
  // one either.
  const verdict = await checkRegisterLimit(await headers());
  if (!verdict.allowed) {
    return { error: registerLimitMessage(verdict) };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists" };
  }

  const passwordHash = await hashPassword(password);
  await db.user.create({ data: { email, passwordHash } });

  redirect("/login?registered=true");
}
