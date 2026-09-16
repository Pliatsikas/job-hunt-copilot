import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ captured?: string }>;
}) {
  const user = await requireUser();
  const [t, prefs, leads, counts, watched, { captured }] = await Promise.all([
    getT(),
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
        title={t("jobs.title")}
        description={
          ready ? (
            <>
              {t("jobs.lookingFor")} <strong>{prefs!.targetRoles.join(", ")}</strong>
              {prefs!.city ? ` · ${prefs!.city}` : prefs!.country ? ` · ${prefs!.country}` : ""} · {t(`jobs.remoteLabel.${prefs!.remote}`)} ·{" "}
              <Link href="/profile#preferences" className="underline">
                {t("common.change")}
              </Link>
              <br />
              {prefs!.lastAutoRunAt ? `${t("jobs.lastRun", { date: formatDateTime(prefs!.lastAutoRunAt) })} · ` : ""}
              {prefs!.autoSearch ? t("jobs.autoOn") : t("jobs.autoOff")}
            </>
          ) : (
            <>
              {t("jobs.setUp")}{" "}
              <Link href="/start/2" className="underline">
                {t("jobs.setUpLink")}
              </Link>{" "}
              {t("jobs.setUpTail")}
            </>
          )
        }
        actions={<FindJobsButton ready={ready} />}
      />

      {captured === "1" && (
        <p role="status" className="mb-4 rounded-lg border bg-accent/40 p-3 text-sm">
          {t("jobs.captured")}
        </p>
      )}
      {captured === "known" && (
        <p role="status" className="mb-4 rounded-lg border bg-muted/40 p-3 text-sm">
          {t("jobs.capturedKnown")}
        </p>
      )}

      <section aria-labelledby="queue-heading" className="mb-6">
        <h2 id="queue-heading" className="mb-3 text-base font-semibold">
          {t("jobs.toLookAt", { count: counts.open })}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {t("jobs.added", { count: counts.promoted })} · {t("jobs.dismissed", { count: counts.dismissed })}
          </span>
        </h2>
        {leads.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {ready ? t("jobs.nothingWaiting") : t("jobs.nothingWaitingSetup")}
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

      {/* The tools come after the list: the list is what the visit is for. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">{t("jobs.bookmarkletTitle")}</p>
          <p className="mt-1 text-muted-foreground">{t("jobs.bookmarkletSub")}</p>
          <BookmarkletLink href={bookmarklet}>{t("jobs.bookmarkletButton")}</BookmarkletLink>
          <p className="mt-2 text-xs text-muted-foreground">{t("jobs.bookmarkletNote")}</p>
        </div>
        <WatchEmployers
          curated={CURATED_EMPLOYERS.map((e) => ({ name: e.name, source: e.source, greekJobs: e.greekJobs, checkedOn: e.checkedOn }))}
          own={watched
            .filter((w) => w.source !== "BOOKMARKLET")
            .map((w) => ({ id: w.id, name: w.name, source: w.source, query: w.query }))}
        />
      </div>
    </Page>
  );
}
