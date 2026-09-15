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
            {lead.source}
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
        <div className="shrink-0 text-right">
          {lead.matchScore !== null ? (
            <p className="text-2xl font-semibold tabular-nums">{lead.matchScore}</p>
          ) : (
            <form action={score}>
              <Button type="submit" size="sm" variant="secondary" disabled={scoring}>
                {scoring ? "Scoring…" : "Score"}
              </Button>
            </form>
          )}
        </div>
      </div>

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
