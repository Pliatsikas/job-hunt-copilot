"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The only client piece in the shell: the active state needs the pathname,
 * and nothing else here does. Kept to the link itself so the sidebar and
 * tab bar stay server-rendered around it. While the navigation is pending
 * the tapped item dims and pulses — the tab answers the tap before the page
 * does.
 */
export function NavLink({
  href,
  className,
  activeClassName,
  children,
}: {
  href: string;
  className: string;
  activeClassName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? activeClassName : ""}`}
    >
      <PendingWrap>{children}</PendingWrap>
    </Link>
  );
}

function PendingWrap({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={`contents ${pending ? "[&>*]:animate-pulse [&>*]:opacity-70" : ""}`}>{children}</span>;
}
