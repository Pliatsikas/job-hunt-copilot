import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import type { Locale } from "@/lib/i18n/locale";
import type { T } from "@/lib/i18n/t";
import { LanguageSwitch } from "./language-switch";
import { NavigationProgress } from "./navigation-progress";
import { MOBILE_TABS, NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";

/**
 * Desktop: a fixed sidebar with the full nav and the account block. Mobile:
 * a slim top bar and a bottom tab bar, which is where thumbs are. The
 * previous single-row header put six links plus an email on a 390px screen
 * and the page scrolled sideways on every route; nothing here can overflow,
 * because nothing here lays out horizontally past five icons.
 */
export function AppShell({
  email,
  signOut,
  locale,
  t,
  children,
}: {
  email: string | null;
  signOut: () => Promise<void>;
  locale: Locale;
  t: T;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 pt-6 pb-4">
          <Link href="/today" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm">
              J
            </span>
            Job Hunt Copilot
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
          {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
              activeClassName="bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            >
              <Icon className="size-4" aria-hidden />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-col gap-3 border-t border-sidebar-border px-5 py-4">
          <LanguageSwitch current={locale} label={t("nav.language")} />
          {email && (
            <p className="truncate text-xs text-muted-foreground" title={email}>
              {email}
            </p>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <LogOut className="size-4" aria-hidden />
              {t("nav.signOut")}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
          <Link href="/today" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground text-sm">
              J
            </span>
            Job Hunt Copilot
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitch current={locale} label={t("nav.language")} />
            <form action={signOut}>
              <button
                type="submit"
                aria-label={t("nav.signOut")}
                className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </header>

        {/* Bottom padding on mobile keeps the tab bar off the page's last row. */}
        <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>

        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card/95 backdrop-blur md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {MOBILE_TABS.map(({ href, labelKey, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
              activeClassName="text-primary font-medium"
            >
              <Icon className="size-5" aria-hidden />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
