import { BarChart3, Briefcase, Inbox, Sun, UserRound, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/t";

export type NavItem = { href: string; labelKey: MessageKey; icon: LucideIcon };

/**
 * Five destinations. Usage left the menu in T06: it is a check, not a place
 * to go, and it now shows as a line next to whatever spends the budget.
 * Labels are message keys so the shell renders in whichever language the
 * viewer picked.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", labelKey: "nav.today", icon: Sun },
  { href: "/applications", labelKey: "nav.applications", icon: Briefcase },
  { href: "/leads", labelKey: "nav.jobs", icon: Inbox },
  { href: "/insights", labelKey: "nav.insights", icon: BarChart3 },
  { href: "/profile", labelKey: "nav.profile", icon: UserRound },
];

export const MOBILE_TABS = NAV_ITEMS;
