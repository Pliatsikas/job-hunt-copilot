"use client";

import { useActionState } from "react";
import { dismissLead, scoreLead, type IngestState } from "@/lib/ingest/actions";
import { promoteLead } from "@/lib/applications/promote";
import { Button } from "@/components/ui/button";

export function LeadRow({
  lead,
}: {
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
  const [scoreState, score, scoring] = useActionState<IngestState, FormData>(
    scoreLead.bind(null, lead.id),
    {},
  );

  return (
    <li className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">
            {lead.roleTitle}
            <span className="font-normal text-muted-foreground"> · {lead.companyName}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {lead.source === "BOOKMARKLET" ? "saved by you" : lead.source.toLowerCase()}
            {lead.location ? ` · ${lead.location}` : ""}
            {lead.jobUrl && (
              <>
                {" · "}
                <a href={lead.jobUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  posting
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {lead.fitScore !== null && (
            <p className="text-xs text-muted-foreground" title="How well the posting matches what you are looking for — no model involved">
              fit <span className="font-semibold tabular-nums text-foreground">{lead.fitScore}</span>
            </p>
          )}
          {lead.matchScore !== null ? (
            <p className="text-2xl font-semibold tabular-nums" title="Match score from the analysis">{lead.matchScore}</p>
          ) : (
            <form action={score}>
              <Button type="submit" size="sm" variant="secondary" disabled={scoring}>
                {scoring ? "Scoring…" : "Score"}
              </Button>
            </form>
          )}
        </div>
      </div>

      {lead.matchedTerms.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {lead.matchedTerms.slice(0, 8).map((t) => (
            <li key={t} className="rounded-md bg-accent/60 px-1.5 py-0.5 text-[11px] text-accent-foreground">
              {t}
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

      <div className="mt-3 flex items-center gap-2">
        <form action={promoteLead.bind(null, lead.id)}>
          <Button type="submit" size="sm">
            Add to applications
          </Button>
        </form>
        <form action={dismissLead.bind(null, lead.id)}>
          <Button type="submit" size="sm" variant="ghost">
            Dismiss
          </Button>
        </form>
      </div>
    </li>
  );
}
