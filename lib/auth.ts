import NextAuth, { CredentialsSignin } from "next-auth";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import Credentials, { type CredentialsConfig } from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { checkLoginLimit } from "./auth-limits";
import { db } from "./db";
import { env } from "./env";
import { verifyPassword } from "./password";
import authConfig from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * Distinguishable from a bad password so the sign-in form can say which it
 * was. Auth.js turns anything thrown here into a CredentialsSignin, and
 * carries `code` through to the caller.
 */
export const LOGIN_RATE_LIMITED_CODE = "rate_limited";

class LoginRateLimited extends CredentialsSignin {
  code = LOGIN_RATE_LIMITED_CODE;
}

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: { email: {}, password: {} },
    // The second parameter is the actual HTTP request, which is why the rate
    // limit lives here: both the sign-in server action and a direct POST to
    // /api/auth/callback/credentials arrive through this function, and only
    // one of those goes near the action.
    authorize: (async (raw, request: Request) => {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;

      const verdict = await checkLoginLimit(request.headers);
      if (!verdict.allowed) throw new LoginRateLimited();

      const user = await db.user.findUnique({ where: { email: parsed.data.email } });
      if (!user?.passwordHash) return null;

      const valid = await verifyPassword(parsed.data.password, user.passwordHash);
      if (!valid) return null;

      return user;
    }) as CredentialsConfig["authorize"],
  }),
];

// Registered only when both halves of the credential pair are present, so
// environments without a stable OAuth callback (Preview) still boot and keep
// credentials login working. See SPEC.md §8 Α7.
export const githubEnabled = Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET);

if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
  providers.unshift(
    GitHub({ clientId: env.AUTH_GITHUB_ID, clientSecret: env.AUTH_GITHUB_SECRET }),
  );
} else {
  console.info(
    "Auth: GitHub sign-in disabled — AUTH_GITHUB_ID/AUTH_GITHUB_SECRET not set.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  // Credentials provider can't use the "database" session strategy — there's
  // no OAuth-style redirect for the adapter to persist a Session row against.
  // JWT is required whenever Credentials is one of the providers.
  session: { strategy: "jwt" },
  trustHost: true,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    // Auth.js sets the standard JWT `sub` claim to the user id on sign-in —
    // no need for a custom token field or a next-auth/jwt type augmentation.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}
