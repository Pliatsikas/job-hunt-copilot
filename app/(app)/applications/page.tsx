import type { Metadata } from "next";
import Link from "next/link";
import {
  countApplications,
  listApplications,
  listCompaniesForFilter,
} from "@/lib/applications/queries";
import { applicationFiltersSchema, SORT_FIELDS, STATUSES } from "@/lib/schemas/application";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS, StatusBadge } from "@/components/status-badge";
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

const SORT_LABELS: Record<(typeof SORT_FIELDS)[number], string> = {
  created: "Added",
  applied: "Applied",
  nextAction: "Next action",
  role: "Role",
};

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

  const [applications, companies, total] = await Promise.all([
    listApplications(filters),
    listCompaniesForFilter(),
    countApplications(),
  ]);

  const filtersActive = Boolean(filters.status || filters.company || filters.q);

  return (
    <Page wide>
      <PageHeader
        title="Applications"
        description={
          total === 0
            ? "Nothing tracked yet."
            : `${total} active ${total === 1 ? "application" : "applications"}`
        }
        actions={
          <Link href="/applications/new" className={buttonVariants()}>
            Add application
          </Link>
        }
      />

      {total > 0 && (
        <details className="group mb-4 rounded-xl border bg-card open:pb-4 sm:open:pb-0" open>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium sm:hidden">
            Filters{filtersActive ? " · active" : ""}
          </summary>
        <form method="GET" className="flex flex-wrap items-end gap-3 px-4 pb-4 pt-0 sm:p-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="q" className="text-xs text-muted-foreground">
              Search
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Role, company, description…"
              className="w-56"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-xs text-muted-foreground">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={filters.status ?? ""}
              className={selectClass}
            >
              <option value="">All</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="company" className="text-xs text-muted-foreground">
              Company
            </label>
            <select
              id="company"
              name="company"
              defaultValue={filters.company ?? ""}
              className={selectClass}
            >
              <option value="">All</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sort" className="text-xs text-muted-foreground">
              Sort by
            </label>
            <select id="sort" name="sort" defaultValue={filters.sort} className={selectClass}>
              {SORT_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {SORT_LABELS[field]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="dir" className="text-xs text-muted-foreground">
              Order
            </label>
            <select id="dir" name="dir" defaultValue={filters.dir} className={selectClass}>
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {filtersActive && (
            <Link href="/applications" className={buttonVariants({ variant: "ghost" })}>
              Clear
            </Link>
          )}
        </form>
        </details>
      )}

      {total === 0 ? (
        <EmptyPipeline />
      ) : applications.length === 0 ? (
        <NoMatches />
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
                    {application.appliedAt && <span>Applied {formatDate(application.appliedAt)}</span>}
                    {application.nextActionAt && (
                      <span>Next {formatDate(application.nextActionAt)}</span>
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
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="hidden lg:table-cell">Source</TableHead>
                  <TableHead className="hidden md:table-cell">Applied</TableHead>
                  <TableHead className="hidden md:table-cell">Next action</TableHead>
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

function EmptyPipeline() {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <h2 className="text-base font-medium">Track your first application</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Paste a job posting and the role you applied for. Everything else — the match
        analysis, cover letters, follow-up reminders — builds on top of what you save here.
      </p>
      <Link
        href="/applications/new"
        className={buttonVariants({ className: "mt-5" })}
      >
        Add your first application
      </Link>
    </div>
  );
}

function NoMatches() {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <h2 className="text-base font-medium">No applications match these filters</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing is wrong — the filters are just narrower than your pipeline.
      </p>
      <Link
        href="/applications"
        className={buttonVariants({ variant: "secondary", className: "mt-5" })}
      >
        Clear filters
      </Link>
    </div>
  );
}
