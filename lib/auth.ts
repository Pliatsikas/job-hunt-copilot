import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { db } from "./db";
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  // Credentials provider can't use the "database" session strategy — there's
  // no OAuth-style redirect for the adapter to persist a Session row against.
  // JWT is required whenever Credentials is one of the providers.
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    GitHub,
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return user;
      },
    }),
  ],
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
