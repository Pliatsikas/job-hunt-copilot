import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";

// Built from the edge-safe config only — importing lib/auth.ts here would
// pull the Prisma pg adapter and bcryptjs into the Edge middleware bundle,
// neither of which run there. Redirect-to-/login on failure is handled by
// authConfig's `authorized` callback (Auth.js's own middleware convention).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
