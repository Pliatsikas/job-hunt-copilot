import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, HelpCircle, PenLine } from "lucide-react";
import { addNote, changeStatus } from "@/lib/applications/actions";
import { analyzeApplication } from "@/lib/applications/analyze";
import { requireOwnedApplication } from "@/lib/applications/guards";
import { listAnalyses, listDocuments, listEvents } from "@/lib/applications/queries";
import { tailorCv } from "@/lib/applications/tailor";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getUsageToday } from "@/lib/llm/usage";
import { getProfile } from "@/lib/profile/get";
import { formatDate, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { AnalysisView } from "./analysis-view";
import { AnalyzeButton } from "./analyze-button";
import { DocumentActions } from "./document-actions";
import { GeneratePanel } from "./generate-panel";
import { NoteForm } from "./note-form";
import { StatusChanger } from "./status-changer";
import { TailorButton } from "./tailor-button";

/**
 * One column, in the order things happen: analyse; read the result; write
 * the letter, build the CV, read the questions. The posting, the status and
 * the history are here but below, folded, because they are not what the
 * visit is for.
 */
export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const application = await requireOwnedApplication(id).catch(() => null);
  if (!application) notFound();

  const [t, user, profile, events, analyses, documents] = await Promise.all([
    getT(),
    requireUser(),
    getProfile(),
    listEvents(application.id),
    listAnalyses(application.id),
    listDocuments(application.id),
  ]);
  const usage = await getUsageToday(user.id);
  const [latestAnalysis, ...previousAnalyses] = analyses;
  const hasCv = Boolean(profile?.cvText.trim());
  const calls = t("common.callsToday", { used: usage.requests, limit: usage.limits.requests });

  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/applications" className="underline-offset-4 hover:underline">
            ← {t("application.back")}
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
            {application.company?.name ?? t("application.noCompany")}
            {application.location ? ` · ${application.location}` : ""}
            {` · ${t(`application.workMode.${application.workMode}`)}`}
          </>
        }
        actions={
          <Link href={`/applications/${application.id}/edit`} className={buttonVariants({ variant: "secondary" })}>
            {t("application.edit")}
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {!latestAnalysis ? (
          <section className="rounded-xl border bg-card p-6 text-center sm:p-8">
            <h2 className="text-lg font-semibold">{t("application.seeHowYouMatch")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("application.seeHowYouMatchSub")}</p>
            <div className="mt-5 flex flex-col items-center gap-2">
              {hasCv ? (
                <>
                  <AnalyzeButton action={analyzeApplication.bind(null, application.id)} hasPrevious={false} size="lg" />
                  <span className="text-xs text-muted-foreground">{calls}</span>
                </>
              ) : (
                <>
                  <p className="text-sm text-destructive">{t("application.needCv")}</p>
                  <Link href="/start/1" className={buttonVariants()}>
                    {t("application.addCv")}
                  </Link>
                </>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-xl border bg-card p-4 sm:p-6">
              <AnalysisView analysis={latestAnalysis} t={t} />
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4 text-xs text-muted-foreground">
                <AnalyzeButton action={analyzeApplication.bind(null, application.id)} hasPrevious size="sm" />
                <span>{calls}</span>
              </div>
            </section>

            <section aria-labelledby="next-steps">
              <h2 id="next-steps" className="mb-3 text-base font-semibold">
                {t("application.nextSteps")}
              </h2>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border bg-card p-4 sm:p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <PenLine className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                    <div>
                      <h3 className="font-medium">{t("application.writeLetter")}</h3>
                      <p className="text-sm text-muted-foreground">{t("application.letterSub")}</p>
                    </div>
                  </div>
                  <GeneratePanel applicationId={application.id} kind="COVER_LETTER" />
                </div>

                <div className="rounded-xl border bg-card p-4 sm:p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                    <div>
                      <h3 className="font-medium">{t("application.makeCv")}</h3>
                      <p className="text-sm text-muted-foreground">{t("application.cvSub")}</p>
                    </div>
                  </div>
                  <TailorButton
                    action={tailorCv.bind(null, application.id)}
                    hasAnalysis
                    hasPrevious={documents.some((d) => d.type === "CV_TAILORED")}
                  />
                </div>

                <a href="#questions" className="flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/30 sm:p-5">
                  <HelpCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <h3 className="font-medium">{t("application.questions")}</h3>
                    <p className="text-sm text-muted-foreground">{t("application.questionsSub")}</p>
                  </div>
                </a>

                <div id="follow-up" className="rounded-xl border bg-card p-4 sm:p-5">
                  <div className="mb-3">
                    <h3 className="font-medium">{t("application.followUpTitle")}</h3>
                    <p className="text-sm text-muted-foreground">{t("application.followUpSub")}</p>
                  </div>
                  <GeneratePanel applicationId={application.id} kind="FOLLOW_UP_EMAIL" />
                </div>
              </div>
            </section>
          </>
        )}

        {documents.length > 0 && (
          <section className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold">
              {t("application.documents")} <span className="font-normal text-muted-foreground">({documents.length})</span>
            </h2>
            <div className="flex flex-col gap-3">
              {documents.map((doc) => (
                <details key={doc.id} className="rounded-lg border p-4">
                  <summary className="cursor-pointer text-sm">
                    {t(`application.docKinds.${doc.type}`)}
                    {doc.context ? ` (${t(`application.contexts.${doc.context === "AFTER_APPLYING" ? "after_applying" : doc.context === "AFTER_INTERVIEW" ? "after_interview" : "nudge"}`)})` : ""} · v
                    {doc.version} · {doc.language} · {formatDateTime(doc.createdAt)}
                  </summary>
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="rounded-lg bg-muted/30 p-3 text-sm whitespace-pre-wrap">{doc.content}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <DocumentActions
                        content={doc.content}
                        filename={`${doc.type === "COVER_LETTER" ? "cover-letter" : doc.type === "CV_TAILORED" ? "cv" : "follow-up"}-v${doc.version}-${doc.language}.md`}
                      />
                      {doc.type === "CV_TAILORED" && (
                        <Link href={`/applications/${application.id}/cv/${doc.version}`} className="text-sm underline">
                          {t("application.openPrintView")}
                        </Link>
                      )}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        <details className="rounded-xl border bg-card p-4 sm:p-5">
          <summary className="cursor-pointer text-base font-semibold">{t("application.theJob")}</summary>
          <p className="mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {application.jobDescription}
          </p>
          <dl className="mt-4 grid gap-2 border-t pt-4 text-sm sm:grid-cols-2">
            <Detail label={t("application.source")} value={application.source} />
            <Detail label={t("application.applied")} value={formatDate(application.appliedAt)} />
            <Detail label={t("application.nextAction")} value={formatDate(application.nextActionAt)} />
            <Detail label={t("application.salary")} value={application.salaryNote} />
            {application.jobUrl && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("application.posting")}</dt>
                <dd>
                  <a href={application.jobUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {t("application.open")}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </details>

        {previousAnalyses.length > 0 && (
          <details className="rounded-xl border bg-card p-4 sm:p-5">
            <summary className="cursor-pointer text-base font-semibold">{t("application.previous", { count: previousAnalyses.length })}</summary>
            <div className="mt-3 flex flex-col gap-4">
              {previousAnalyses.map((analysis) => (
                <details key={analysis.id} className="rounded-lg border p-4">
                  <summary className="cursor-pointer text-sm">
                    {t("application.score", { score: analysis.matchScore })} · {formatDateTime(analysis.createdAt)} · {analysis.promptVersion}
                  </summary>
                  <div className="mt-4">
                    <AnalysisView analysis={analysis} t={t} compact />
                  </div>
                </details>
              ))}
            </div>
          </details>
        )}

        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-semibold">{t("application.status")}</h2>
          <StatusChanger action={changeStatus.bind(null, application.id)} current={application.status} />
        </section>

        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-semibold">{t("application.history")}</h2>
          <div className="flex flex-col gap-5">
            <NoteForm action={addNote.bind(null, application.id)} />
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("application.nothingLogged")}</p>
            ) : (
              <ol className="flex flex-col gap-4 border-l pl-4">
                {events.map((event) => (
                  <li key={event.id} className="text-sm">
                    <div className="text-xs text-muted-foreground">{formatDateTime(event.at)}</div>
                    {event.type === "STATUS_CHANGE" ? (
                      <div className="mt-0.5">
                        {t("application.status")}:{" "}
                        <span className="text-muted-foreground">{event.fromStatus ? t(`application.statuses.${event.fromStatus}`) : "—"}</span> →{" "}
                        <span className="font-medium">{event.toStatus ? t(`application.statuses.${event.toStatus}`) : "—"}</span>
                      </div>
                    ) : (
                      <p className="mt-0.5 whitespace-pre-wrap">{event.body}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </Page>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value ?? "—"}</dd>
    </div>
  );
}
