import type { Metadata } from "next";
import Link from "next/link";
import {
  countApplications,
  listApplications,
  listCompaniesForFilter,
} from "@/lib/applications/queries";
import { applicationFiltersSchema, SORT_FIELDS, STATUSES } from "@/lib/schemas/application";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { SELECT_FOCUS } from "@/components/ui/select-focus";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const selectClass =
  "h-9 rounded-lg border border-border bg-background px-2.5 text-sm" + SELECT_FOCUS;

export const metadata: Metadata = {
  title: "Applications",
  description:
    "Every application you are tracking, filtered by status, company or keyword.",
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = applicationFiltersSchema.parse(raw);
  const t = await getT();

  const [applications, companies, total] = await Promise.all([
    listApplications(filters),
    listCompaniesForFilter(),
    countApplications(),
  ]);

  const filtersActive = Boolean(filters.status || filters.company || filters.q);

  return (
    <Page wide>
      <PageHeader
        title={t("applications.title")}
        description={total === 0 ? t("applications.nothingYet") : t("applications.active", { count: total })}
        actions={
          <Link href="/applications/new" className={buttonVariants()}>
            {t("applications.add")}
          </Link>
        }
      />

      {total > 0 && (
        <details className="group mb-4 rounded-xl border bg-card open:pb-4 sm:open:pb-0" open>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium sm:hidden">
            {t("applications.filters")}{filtersActive ? ` · ${t("applications.filtersActive")}` : ""}
          </summary>
        <form method="GET" className="flex flex-wrap items-end gap-3 px-4 pb-4 pt-0 sm:p-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="q" className="text-xs text-muted-foreground">
              {t("applications.search")}
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder={t("applications.searchPlaceholder")}
              className="w-56"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-xs text-muted-foreground">
              {t("applications.status")}
            </label>
            <select
              id="status"
              name="status"
              defaultValue={filters.status ?? ""}
              className={selectClass}
            >
              <option value="">{t("applications.all")}</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`application.statuses.${status}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="company" className="text-xs text-muted-foreground">
              {t("applications.company")}
            </label>
            <select
              id="company"
              name="company"
              defaultValue={filters.company ?? ""}
              className={selectClass}
            >
              <option value="">{t("applications.all")}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sort" className="text-xs text-muted-foreground">
              {t("applications.sortBy")}
            </label>
            <select id="sort" name="sort" defaultValue={filters.sort} className={selectClass}>
              {SORT_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {t(`applications.sortOptions.${field}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="dir" className="text-xs text-muted-foreground">
              {t("applications.order")}
            </label>
            <select id="dir" name="dir" defaultValue={filters.dir} className={selectClass}>
              <option value="desc">{t("applications.newestFirst")}</option>
              <option value="asc">{t("applications.oldestFirst")}</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">
            {t("applications.apply")}
          </Button>
          {filtersActive && (
            <Link href="/applications" className={buttonVariants({ variant: "ghost" })}>
              {t("applications.clear")}
            </Link>
          )}
        </form>
        </details>
      )}

      {total === 0 ? (
        <EmptyPipeline t={t} />
      ) : applications.length === 0 ? (
        <NoMatches t={t} />
      ) : (
        <>
          {/* Cards under sm: six columns cannot fit 390px and a sideways-scrolling
              table hides the column that says whether anything needs doing. */}
          <ul className="flex flex-col gap-3 sm:hidden">
            {applications.map((application) => (
              <li key={application.id}>
                <Link
                  href={`/applications/${application.id}`}
                  className="block rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{application.roleTitle}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {application.company?.name ?? "—"}
                      </p>
                    </div>
                    <ScoreBadge score={application.latestMatchScore} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <StatusBadge status={application.status} />
                    {application.appliedAt && <span>{t("applications.applied", { date: formatDate(application.appliedAt) ?? "" })}</span>}
                    {application.nextActionAt && (
                      <span>{t("applications.next", { date: formatDate(application.nextActionAt) ?? "" })}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border bg-card sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("applications.role")}</TableHead>
                  <TableHead>{t("applications.company")}</TableHead>
                  <TableHead>{t("applications.status")}</TableHead>
                  <TableHead className="text-right">{t("applications.score")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("applications.source")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("applications.appliedCol")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("applications.nextCol")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/applications/${application.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {application.roleTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {application.company?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={application.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ScoreBadge score={application.latestMatchScore} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {application.source ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(application.appliedAt) ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(application.nextActionAt) ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Page>
  );
}

function EmptyPipeline({ t }: { t: T }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <h2 className="text-base font-medium">{t("applications.emptyTitle")}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("applications.emptySub")}</p>
      <Link href="/applications/new" className={buttonVariants({ className: "mt-5" })}>
        {t("applications.emptyCta")}
      </Link>
    </div>
  );
}

function NoMatches({ t }: { t: T }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <h2 className="text-base font-medium">{t("applications.noMatchesTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("applications.noMatchesSub")}</p>
      <Link href="/applications" className={buttonVariants({ variant: "secondary", className: "mt-5" })}>
        {t("applications.clearFilters")}
      </Link>
    </div>
  );
}
