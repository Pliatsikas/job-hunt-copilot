"use client";

import { useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";

/**
 * React refuses to render a `javascript:` href — it rewrites it to one that
 * throws "React has blocked a javascript: URL as a security precaution". That
 * is the right default for an app, and it is exactly what a bookmarklet is
 * made of: what the owner dragged to their bookmarks bar on the first try was
 * a bookmark that threw. So the href is written to the DOM after mount,
 * imperatively, where React's sanitiser does not look. The value is ours, not
 * user input, and it is generated on the server from our own origin.
 */
export function BookmarkletLink({ href, children }: { href: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    ref.current?.setAttribute("href", href);
  }, [href]);

  return (
    <a
      ref={ref}
      // A click on our own page would run it against our own page, which
      // does nothing useful; dragging is the point.
      onClick={(e) => e.preventDefault()}
      className={`${buttonVariants({ variant: "secondary", size: "sm" })} mt-3 cursor-grab`}
      draggable
      title="Drag me to your bookmarks bar"
    >
      {children}
    </a>
  );
}
