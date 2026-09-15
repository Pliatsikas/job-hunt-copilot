import Link from "next/link";
import { notFound } from "next/navigation";
import { addNote, changeStatus } from "@/lib/applications/actions";
import { analyzeApplication } from "@/lib/applications/analyze";
import { requireOwnedApplication } from "@/lib/applications/guards";
import {
  listAnalyses,
  listDocuments,
  listEvents,
} from "@/lib/applications/queries";
import { DB_TO_CONTEXT_LABEL } from "@/lib/llm/prompts/follow-up.v1";
import { formatDate, formatDateTime } from "@/lib/format";
import { STATUS_LABELS, StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { AnalysisView } from "./analysis-view";
import { AnalyzeButton } from "./analyze-button";
import { TailorButton } from "./tailor-button";
import { tailorCv } from "@/lib/applications/tailor";
import { DOC_LABEL } from "@/lib/applications/documents";
import { DocumentActions } from "./document-actions";
import { GeneratePanel } from "./generate-panel";
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

  const [events, analyses, documents] = await Promise.all([
    listEvents(application.id),
    listAnalyses(application.id),
    listDocuments(application.id),
  ]);
  const [latestAnalysis, ...previousAnalyses] = analyses;

  return (
    <Page wide>
      <PageHeader
        eyebrow={
          <Link
            href="/applications"
            className="underline-offset-4 hover:underline"
          >
            ← Applications
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {application.roleTitle}
            <StatusBadge status={application.status} />
            <ScoreBadge score={application.latestMatchScore} size="lg" />
          </span>
        }
        description={
          <>
            {application.company?.name ?? "No company"}
            {application.location ? ` · ${application.location}` : ""}
            {` · ${application.workMode.charAt(0)}${application.workMode.slice(1).toLowerCase()}`}
          </>
        }
        actions={
          <Link
            href={`/applications/${application.id}/edit`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Edit
          </Link>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Main column: the posting and everything derived from it, in reading
            order. Sidebar: actions and facts. On mobile the sidebar comes
            first, because status and "analyse" are what a phone visit is for. */}
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle>Job description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {application.jobDescription}
              </p>
            </CardContent>
          </Card>

          {latestAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle>Match analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <AnalysisView analysis={latestAnalysis} />
              </CardContent>
            </Card>
          )}

          {previousAnalyses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Previous analyses ({previousAnalyses.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {previousAnalyses.map((analysis) => (
                  <details key={analysis.id} className="rounded-lg border p-4">
                    <summary className="cursor-pointer text-sm">
                      Score {analysis.matchScore} ·{" "}
                      {formatDateTime(analysis.createdAt)} ·{" "}
                      {analysis.promptVersion}
                    </summary>
                    <div className="mt-4">
                      <AnalysisView analysis={analysis} />
                    </div>
                  </details>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Generate</CardTitle>
            </CardHeader>
            <CardContent>
              <GeneratePanel applicationId={application.id} />
            </CardContent>
          </Card>

          {documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Saved documents ({documents.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {documents.map((doc) => (
                  <details key={doc.id} className="rounded-lg border p-4">
                    <summary className="cursor-pointer text-sm">
                      {DOC_LABEL[doc.type]}
                      {doc.context
                        ? ` (${DB_TO_CONTEXT_LABEL[doc.context]})`
                        : ""}{" "}
                      · v{doc.version} · {doc.language} ·{" "}
                      {formatDateTime(doc.createdAt)}
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="rounded-lg bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                        {doc.content}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <DocumentActions
                          content={doc.content}
                          filename={`${doc.type === "COVER_LETTER" ? "cover-letter" : doc.type === "CV_TAILORED" ? "cv" : "follow-up"}-v${doc.version}-${doc.language}.md`}
                        />
                        {doc.type === "CV_TAILORED" && (
                          <Link
                            href={`/applications/${application.id}/cv/${doc.version}`}
                            className="text-sm underline"
                          >
                            Open print view (PDF)
                          </Link>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <NoteForm action={addNote.bind(null, application.id)} />

              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing logged yet. Notes you add and every status change show
                  up here.
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
                            {event.fromStatus
                              ? STATUS_LABELS[event.fromStatus]
                              : "—"}
                          </span>{" "}
                          →{" "}
                          <span className="font-medium">
                            {event.toStatus
                              ? STATUS_LABELS[event.toStatus]
                              : "—"}
                          </span>
                        </div>
                      ) : (
                        <p className="mt-0.5 whitespace-pre-wrap">
                          {event.body}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="order-1 flex flex-col gap-6 lg:order-2">
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
              <CardTitle>Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <AnalyzeButton
                action={analyzeApplication.bind(null, application.id)}
                hasPrevious={analyses.length > 0}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tailored CV</CardTitle>
            </CardHeader>
            <CardContent>
              <TailorButton
                action={tailorCv.bind(null, application.id)}
                hasAnalysis={analyses.length > 0}
                hasPrevious={documents.some((d) => d.type === "CV_TAILORED")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Detail label="Source" value={application.source} />
              <Detail
                label="Applied"
                value={formatDate(application.appliedAt)}
              />
              <Detail
                label="Next action"
                value={formatDate(application.nextActionAt)}
              />
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
    </Page>
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
