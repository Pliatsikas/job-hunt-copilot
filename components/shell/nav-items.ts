import {
  BarChart3,
  Briefcase,
  Gauge,
  Inbox,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * One list, two renderings. The sidebar shows all six; the mobile tab bar
 * shows the first five and folds Usage into the account menu, because five
 * tabs is the most a thumb can hit reliably and Usage is a check, not a
 * destination.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/applications", label: "Applications", icon: Briefcase },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/usage", label: "Usage", icon: Gauge },
];

export const MOBILE_TABS = NAV_ITEMS.slice(0, 5);
