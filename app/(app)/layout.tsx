import type { ReactNode } from "react";
import { auth, signOut } from "@/lib/auth";
import { getLocale, getT } from "@/lib/i18n/server";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [session, locale, t] = await Promise.all([auth(), getLocale(), getT()]);

  return (
    <AppShell
      email={session?.user?.email ?? null}
      locale={locale}
      t={t}
      signOut={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      {children}
    </AppShell>
  );
}
