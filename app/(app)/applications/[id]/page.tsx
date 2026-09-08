import Link from "next/link";
import { notFound } from "next/navigation";
import { addNote, changeStatus } from "@/lib/applications/actions";
import { requireOwnedApplication } from "@/lib/applications/guards";
import { listEvents } from "@/lib/applications/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { STATUS_LABELS, StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NoteForm } from "./note-form";
import { StatusChanger } from "./status-changer";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const application = await requireOwnedApplication(id).catch(() => null);
  if (!application) notFound();

  const events = await listEvents(application.id);

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/applications"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Applications
          </Link>
          <h1 className="mt-2 flex items-center gap-3 text-xl font-semibold">
            {application.roleTitle}
            <StatusBadge status={application.status} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {application.company?.name ?? "No company"}
            {application.location ? ` · ${application.location}` : ""}
            {` · ${application.workMode.charAt(0)}${application.workMode.slice(1).toLowerCase()}`}
          </p>
        </div>
        <Link
          href={`/applications/${application.id}/edit`}
          className={buttonVariants({ variant: "secondary" })}
        >
          Edit
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Job description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {application.jobDescription}
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusChanger
                action={changeStatus.bind(null, application.id)}
                current={application.status}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Detail label="Source" value={application.source} />
              <Detail label="Applied" value={formatDate(application.appliedAt)} />
              <Detail label="Next action" value={formatDate(application.nextActionAt)} />
              <Detail label="Salary" value={application.salaryNote} />
              {application.jobUrl && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Posting</span>
                  <a
                    href={application.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate underline underline-offset-4"
                  >
                    Open
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <NoteForm action={addNote.bind(null, application.id)} />

          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing logged yet. Notes you add and every status change show up here.
            </p>
          ) : (
            <ol className="flex flex-col gap-4 border-l pl-4">
              {events.map((event) => (
                <li key={event.id} className="text-sm">
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(event.at)}
                  </div>
                  {event.type === "STATUS_CHANGE" ? (
                    <div className="mt-0.5">
                      Status:{" "}
                      <span className="text-muted-foreground">
                        {event.fromStatus ? STATUS_LABELS[event.fromStatus] : "—"}
                      </span>{" "}
                      →{" "}
                      <span className="font-medium">
                        {event.toStatus ? STATUS_LABELS[event.toStatus] : "—"}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap">{event.body}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value ?? "—"}</span>
    </div>
  );
}
