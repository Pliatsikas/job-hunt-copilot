import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookmarkletSource } from "@/lib/ingest/bookmarklet";
import { CURATED_EMPLOYERS } from "@/lib/ingest/employers";
import { countLeads, listNewLeads, listSavedSearches } from "@/lib/ingest/queries";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { BookmarkletLink } from "./bookmarklet-link";
import { FindJobsButton } from "./find-jobs";
import { LeadRow } from "./lead-row";
import { WatchEmployers } from "./watch-employers";

export const metadata: Metadata = {
  title: "Jobs for you",
  description: "Postings from employers' own boards, ranked against your CV and what you are looking for.",
};

export const dynamic = "force-dynamic";

const REMOTE_LABEL: Record<string, string> = {
  REMOTE_ONLY: "remote only",
  REMOTE_OK: "remote or local",
  ONSITE_OK: "local",
  ANY: "anywhere",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ captured?: string }>;
}) {
  const user = await requireUser();
  const [prefs, leads, counts, watched, { captured }] = await Promise.all([
    db.jobPreferences.findUnique({ where: { userId: user.id } }),
    listNewLeads(),
    countLeads(),
    listSavedSearches(),
    searchParams,
  ]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const bookmarklet = bookmarkletSource(`${proto}://${host}`);

  const ready = Boolean(prefs && prefs.targetRoles.length);

  return (
    <Page wide>
      <PageHeader
        title="Jobs for you"
        description={
          ready ? (
            <>
              Looking for <strong>{prefs!.targetRoles.join(", ")}</strong>
              {prefs!.city ? ` in ${prefs!.city}` : prefs!.country ? ` in ${prefs!.country}` : ""} ·{" "}
              {REMOTE_LABEL[prefs!.remote]} ·{" "}
              <Link href="/profile#preferences" className="underline">
                change
              </Link>
            </>
          ) : (
            <>
              Tell the app what you are looking for and it will search employers&apos; boards for
              you.{" "}
              <Link href="/profile#preferences" className="underline">
                Set it up on your profile
              </Link>{" "}
              — one minute, and it starts from your CV.
            </>
          )
        }
        actions={<FindJobsButton ready={ready} />}
      />

      {captured === "1" && (
        <p role="status" className="mb-4 rounded-lg border bg-accent/40 p-3 text-sm">
          Saved from the page you were on. It is in the list below, ranked like the rest.
        </p>
      )}
      {captured === "known" && (
        <p role="status" className="mb-4 rounded-lg border bg-muted/40 p-3 text-sm">
          That one was already here.
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">Save any job with one click</p>
          <p className="mt-1 text-muted-foreground">
            Drag this to your bookmarks bar. On kariera.gr, LinkedIn or any job page, click it
            — the posting lands here, ranked against your CV.
          </p>
          <BookmarkletLink href={bookmarklet}>★ Save to Job Hunt Copilot</BookmarkletLink>
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing is fetched by us from the job site: the click sends what you are already
            looking at. If your bookmarks bar is hidden: ⌘⇧B on Mac, Ctrl+Shift+B on Windows.
          </p>
        </div>
        <WatchEmployers
          curated={CURATED_EMPLOYERS.map((e) => ({ name: e.name, source: e.source, greekJobs: e.greekJobs, checkedOn: e.checkedOn }))}
          own={watched
            .filter((w) => w.source !== "BOOKMARKLET")
            .map((w) => ({ id: w.id, name: w.name, source: w.source, query: w.query }))}
        />
      </div>

      <section aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="mb-3 text-base font-semibold">
          To look at ({counts.open})
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {counts.promoted} added · {counts.dismissed} dismissed
          </span>
        </h2>
        {leads.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {ready
              ? "Nothing waiting. Press “Find jobs now” to read the boards."
              : "Set what you are looking for first, then press “Find jobs now”."}
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
                  fitScore: lead.fitScore,
                  matchedTerms: lead.matchedTerms,
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
      </section>
    </Page>
  );
}
