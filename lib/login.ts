"use server";

import { AuthError } from "next-auth";
import { loginLimitMessage, loginRetryAfterMs } from "./auth-limits";
import { LOGIN_RATE_LIMITED_CODE, signIn } from "./auth";
import { loginSchema } from "./schemas/auth";

export type LoginState = { error?: string };

export async function loginUser(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/today",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // The limit is enforced in authorize() so that a direct POST to the
      // Auth.js endpoint is covered too; this only translates the code back
      // into the message.
      if ((error as { code?: string }).code === LOGIN_RATE_LIMITED_CODE) {
        return {
          error: loginLimitMessage({ allowed: false, retryAfterMs: loginRetryAfterMs() }),
        };
      }
      return { error: "Invalid email or password" };
    }
    throw error;
  }

  return {};
}
