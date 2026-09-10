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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const selectClass = "h-9 rounded-lg border border-border bg-background px-2.5 text-sm";

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
    <div className="px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0
              ? "Nothing tracked yet."
              : `${total} active ${total === 1 ? "application" : "applications"}`}
          </p>
        </div>
        <Link href="/applications/new" className={buttonVariants()}>
          Add application
        </Link>
      </div>

      {total > 0 && (
        <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
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
      )}

      {total === 0 ? (
        <EmptyPipeline />
      ) : applications.length === 0 ? (
        <NoMatches />
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Next action</TableHead>
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
                  <TableCell className="text-muted-foreground">
                    {application.source ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(application.appliedAt) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(application.nextActionAt) ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
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
