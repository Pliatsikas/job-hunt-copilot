import type { NextAuthConfig } from "next-auth";

// Edge-safe subset used by middleware.ts. No adapter, no Credentials
// authorize() — those touch Prisma/pg/bcryptjs, none of which run on Edge.
// The full config in lib/auth.ts spreads this and adds them back in for
// everywhere else (route handlers, server actions, server components).
const PUBLIC_PATHS = ["/login", "/register"];

export default {
  providers: [],
  pages: { signIn: "/login" },
  // The middleware runs its own Auth.js instance from this config, so it needs
  // trustHost in its own right — setting it only in lib/auth.ts leaves the
  // middleware rejecting every request with UntrustedHost. Vercel hides this:
  // Auth.js trusts its hosts automatically there, so it only appears on a
  // self-hosted origin, or on `next start` locally, which is where the
  // end-to-end suite found it.
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isPublic = PUBLIC_PATHS.some((path) => nextUrl.pathname.startsWith(path));
      return isPublic || Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
