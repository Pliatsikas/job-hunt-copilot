"use client";

import { useActionState } from "react";
import { dismissLead, scoreLead, type IngestState } from "@/lib/ingest/actions";
import { promoteLead } from "@/lib/applications/promote";
import { useT } from "@/lib/i18n/client";
import { ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function LeadRow({
  lead,
  index = 0,
}: {
  /** Position in the list, for the entrance stagger. */
  index?: number;
  lead: {
    id: string;
    companyName: string;
    roleTitle: string;
    location: string | null;
    jobUrl: string | null;
    source: string;
    matchScore: number | null;
    fitScore: number | null;
    matchedTerms: string[];
    droppedClaims: number | null;
    summary: string | null;
    excerpt: string;
  };
}) {
  const t = useT();
  const [scoreState, score, scoring] = useActionState<IngestState, FormData>(
    scoreLead.bind(null, lead.id),
    {},
  );

  return (
    <li
      className="rounded-lg border bg-card p-4 animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">
            {lead.roleTitle}
            <span className="font-normal text-muted-foreground"> · {lead.companyName}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {lead.source === "BOOKMARKLET" ? t("jobs.savedByYou") : lead.source.toLowerCase()}
            {lead.location ? ` · ${lead.location}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {lead.fitScore !== null && (
            <p className="text-xs text-muted-foreground" title={t("jobs.fitTitle")}>
              {t("jobs.fit")} <span className="font-semibold tabular-nums text-foreground">{lead.fitScore}</span>
            </p>
          )}
          {lead.matchScore !== null ? (
            <p className="text-2xl font-semibold tabular-nums" title={t("jobs.matchTitle")}>{lead.matchScore}</p>
          ) : (
            <form action={score}>
              <Button type="submit" size="sm" variant="secondary" pending={scoring}>
                {scoring ? t("jobs.scoring") : t("jobs.score")}
              </Button>
            </form>
          )}
        </div>
      </div>

      {lead.matchedTerms.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {lead.matchedTerms.slice(0, 8).map((term) => (
            <li key={term} className="rounded-md bg-accent/60 px-1.5 py-0.5 text-[11px] text-accent-foreground">
              {term}
            </li>
          ))}
        </ul>
      )}
      {lead.summary ? (
        <p className="mt-2 text-sm">{lead.summary}</p>
      ) : (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{lead.excerpt}</p>
      )}
      {scoreState.error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {scoreState.error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={promoteLead.bind(null, lead.id)}>
          <Button type="submit" size="sm">
            {t("jobs.interested")}
          </Button>
        </form>
        {/* Where it was found is where you apply: the source's own page, a new tab. */}
        {lead.jobUrl && (
          <a
            href={lead.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "sm", variant: "secondary" })}
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("jobs.openPosting")}
          </a>
        )}
        <form action={dismissLead.bind(null, lead.id)}>
          <Button type="submit" size="sm" variant="ghost">
            {t("jobs.notInterested")}
          </Button>
        </form>
      </div>
    </li>
  );
}
