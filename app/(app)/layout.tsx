import type { ReactNode } from "react";
import { auth, signOut } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <AppShell
      email={session?.user?.email ?? null}
      signOut={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      {children}
    </AppShell>
  );
}
