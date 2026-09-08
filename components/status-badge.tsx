import { Badge } from "@/components/ui/badge";
import type { STATUSES } from "@/lib/schemas/application";

type Status = (typeof STATUSES)[number];

const LABELS: Record<Status, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

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
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}

export const STATUS_LABELS = LABELS;
