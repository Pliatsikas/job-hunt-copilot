import Link from "next/link";
import type { ReactNode } from "react";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/today" className="font-semibold">
          Job Hunt Copilot
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600">
          <Link href="/today">Today</Link>
          <Link href="/applications">Applications</Link>
          <Link href="/insights">Insights</Link>
          <Link href="/profile">Profile</Link>
          {session?.user?.email && (
            <span className="text-zinc-400">{session.user.email}</span>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
