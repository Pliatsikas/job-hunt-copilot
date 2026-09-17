"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A thin bar along the top that starts the instant a link is clicked and
 * finishes when the route has changed. It exists for the gap between the
 * click and the new page's skeleton — the moment where "did I press it?"
 * lives. Clicks are read at the document level, so no link has to opt in;
 * anything that is not a plain same-origin navigation (new tab, download,
 * modifier keys, hash links) is ignored.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const started = useRef<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      const here = location.pathname + location.search;
      const there = url.pathname + url.search;
      if (there === here) return;
      started.current = there;
      setActive(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The route committed: finish. Also covers a server action's redirect,
  // which never went through a click.
  useEffect(() => {
    started.current = null;
    setActive(false);
  }, [pathname, search]);

  // A click that never navigates (a link that opened a dialog, a failed
  // prefetch) must not leave the bar running forever.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 8000);
    return () => clearTimeout(t);
  }, [active]);

  // While a navigation is pending the current page dims (globals.css reads
  // this attribute), so the old content visibly steps back before the new
  // page lands. This replaces route-level loading.tsx skeletons on purpose:
  // see docs/tasks/T08-feels-fast.md — a loading boundary above a page
  // breaks every server action that revalidates that page on Next 15.5.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-navigating", active);
    return () => document.documentElement.removeAttribute("data-navigating");
  }, [active]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary transition-opacity duration-200 ${
        active ? "animate-progress opacity-100" : "opacity-0"
      }`}
    />
  );
}
