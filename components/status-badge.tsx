"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/client";
import type { STATUSES } from "@/lib/schemas/application";

type Status = (typeof STATUSES)[number];

// Colour carries meaning here (live pipeline vs closed out), so it is paired
// with the label text rather than replacing it.
const VARIANTS: Record<Status, "default" | "secondary" | "outline" | "destructive"> = {
  SAVED: "outline",
  APPLIED: "secondary",
  SCREENING: "secondary",
  INTERVIEW: "default",
  OFFER: "default",
  REJECTED: "destructive",
  WITHDRAWN: "outline",
};

export function StatusBadge({ status }: { status: Status }) {
  const t = useT();
  return <Badge variant={VARIANTS[status]}>{t(`application.statuses.${status}`)}</Badge>;
}
