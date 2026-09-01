import Link from "next/link";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/today" className="font-semibold">
          Job Hunt Copilot
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600">
          <Link href="/today">Today</Link>
          {/* Sign-in / user menu lands here once M1 adds auth */}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
