import type { ReactNode } from "react";
import { auth, signOut } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getT, MESSAGES } from "@/lib/i18n/server";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = await getT();

  return (
    <I18nProvider locale={locale} messages={MESSAGES[locale]}>
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
    </I18nProvider>
  );
}
