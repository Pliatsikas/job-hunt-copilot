import type { Metadata } from "next";
import { countLeads, listNewLeads, listSavedSearches } from "@/lib/ingest/queries";
import { SOURCE_LIST } from "@/lib/ingest/sources";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadRow } from "./lead-row";
import { SavedSearchForm, SavedSearchRow } from "./saved-searches";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Leads",
  description:
    "Postings pulled from public job APIs, scored against your CV on arrival, waiting for a yes or a no.",
};

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const [searches, leads, counts] = await Promise.all([
    listSavedSearches(),
    listNewLeads(),
    countLeads(),
  ]);

  return (
    <Page wide>
      <PageHeader title="Leads" description={<>Postings from public job APIs — company boards on Greenhouse and Lever, and the
        Arbeitnow and Remotive job APIs. No scraping: every source is a documented API built
        for this. Each new lead is scored against your CV; you decide whether it becomes an
        application.</>} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Saved searches</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {searches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None yet. A search is a source plus a query — a company&apos;s board slug, or
                a keyword for the job APIs.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {searches.map((s) => (
                  <SavedSearchRow
                    key={s.id}
                    search={{
                      id: s.id,
                      name: s.name,
                      source: s.source,
                      query: s.query,
                      lastRunAt: s.lastRunAt?.toISOString() ?? null,
                      openLeads: s._count.leads,
                    }}
                  />
                ))}
              </ul>
            )}
            <SavedSearchForm
              sources={SOURCE_LIST.map((s) => ({
                value: s.source,
                label: s.label,
                hint: s.queryHint,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              To triage ({counts.open})
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {counts.promoted} promoted · {counts.dismissed} dismissed
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing waiting. Run a saved search to pull in postings.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {leads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={{
                      id: lead.id,
                      companyName: lead.companyName,
                      roleTitle: lead.roleTitle,
                      location: lead.location,
                      jobUrl: lead.jobUrl,
                      source: lead.source,
                      matchScore: lead.matchScore,
                      droppedClaims: lead.droppedClaims,
                      summary:
                        lead.analysis && typeof lead.analysis === "object" && "summary" in lead.analysis
                          ? String((lead.analysis as { summary?: string }).summary ?? "")
                          : null,
                      excerpt: lead.jobDescription.slice(0, 280),
                    }}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
