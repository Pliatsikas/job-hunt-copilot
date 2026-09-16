import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, Check, MessageSquare } from "lucide-react";
import { markActionDone, snoozeApplication } from "@/lib/applications/reminders";
import { getTodayData, type TodayItem } from "@/lib/applications/today";
import { getT } from "@/lib/i18n/server";
import { getSetupState } from "@/lib/start/setup";
import { buttonVariants } from "@/components/ui/button";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { ItemActions } from "./item-actions";

// Reads "today" per request; a cached page would go stale at local midnight.
export const metadata: Metadata = {
  title: "Today",
  description: "What to do today — one action per line, and nothing else.",
};

export const dynamic = "force-dynamic";

/**
 * Two pages under one URL. Until the guide is finished the page *is* the
 * guide, with one button; afterwards it is a list of things to do, each with
 * one button. Neither view reports numbers for their own sake.
 */
export default async function TodayPage() {
  const [t, setup] = await Promise.all([getT(), getSetupState()]);
  if (setup.nextStep !== null) return <Guide />;

  const data = await getTodayData();
  const rows: Row[] = [
    ...data.overdue.map((item) => toRow(item, "overdue")),
    ...data.dueToday.map((item) => toRow(item, "dueToday")),
    ...data.stale.map((item) => toRow(item, "stale")),
  ];
  const count = rows.length + (data.newLeads > 0 ? 1 : 0);

  return (
    <Page>
      <PageHeader
        title={t("today.title")}
        description={
          count === 0
            ? t("today.nothingDueSub")
            : count === 1
              ? t("today.oneThingToDo")
              : t("today.thingsToDo", { count })
        }
      />

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${row.kind === "overdue" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}>
                <MessageSquare className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <Link href={`/applications/${row.item.id}`} className="font-medium underline-offset-4 hover:underline">
                  {t(`today.${row.kind}`, { role: row.item.roleTitle, days: row.days })}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {t(`today.${row.kind}Sub`, { company: row.item.companyName ?? "—", days: row.days })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/applications/${row.item.id}#follow-up`} className={buttonVariants({ size: "sm" })}>
                {t("today.writeFollowUp")}
              </Link>
              <ItemActions
                snooze={snoozeApplication.bind(null, row.item.id)}
                markDone={markActionDone.bind(null, row.item.id)}
              />
            </div>
          </li>
        ))}

        {data.newLeads > 0 && (
          <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Briefcase className="size-4" aria-hidden />
              </span>
              <div>
                <p className="font-medium">{t("today.newJobs", { count: data.newLeads })}</p>
                <p className="text-sm text-muted-foreground">{t("today.newJobsSub")}</p>
              </div>
            </div>
            <Link href="/leads" className={buttonVariants({ size: "sm" })}>
              {t("today.seeThem")}
            </Link>
          </li>
        )}

        {count === 0 && (
          <li className="rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-base font-medium">{t("today.nothingDue")}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("today.nothingDueSub")}</p>
            <Link href="/leads" className={`${buttonVariants()} mt-5`}>
              {t("today.findJobs")}
            </Link>
          </li>
        )}
      </ul>

      <p className="mt-6 text-sm text-muted-foreground">
        {t("today.pipelineLine", { active: data.activeTotal })} ·{" "}
        <Link href="/applications" className="underline underline-offset-4">
          {t("today.seeAll")}
        </Link>
      </p>
    </Page>
  );
}

type Row = { item: TodayItem; kind: "overdue" | "dueToday" | "stale"; days: number };

function toRow(item: TodayItem, kind: Row["kind"]): Row {
  const days =
    kind === "stale"
      ? (item.daysSinceActivity ?? 0)
      : item.nextActionAt
        ? Math.max(0, Math.floor((Date.now() - item.nextActionAt.getTime()) / 86_400_000))
        : 0;
  return { item, kind, days };
}

/**
 * The first thing a new account sees. Three steps named, the done ones ticked,
 * and one button that goes to whichever step is next.
 */
async function Guide() {
  const [t, setup] = await Promise.all([getT(), getSetupState()]);
  const steps = [
    { n: 1, title: t("today.step1"), sub: t("today.step1Sub"), done: setup.cv },
    { n: 2, title: t("today.step2"), sub: t("today.step2Sub"), done: setup.prefs },
    { n: 3, title: t("today.step3"), sub: t("today.step3Sub"), done: setup.firstApplication },
  ];
  const next = setup.nextStep ?? 1;
  const started = setup.cv || setup.prefs;

  return (
    <Page>
      <div className="mx-auto flex max-w-xl flex-col gap-8 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("today.welcome")}</h1>
          <p className="mt-2 text-muted-foreground">{t("today.welcomeSub")}</p>
        </div>

        <ol className="flex flex-col gap-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className={`flex items-start gap-4 rounded-xl border p-4 ${step.n === next ? "border-primary bg-card" : "bg-card/60"}`}
              aria-current={step.n === next ? "step" : undefined}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  step.done ? "bg-primary text-primary-foreground" : step.n === next ? "border-2 border-primary text-primary" : "border text-muted-foreground"
                }`}
              >
                {step.done ? <Check className="size-4" aria-label={t("common.yes")} /> : step.n}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.sub}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col items-center gap-3">
          <Link href={`/start/${next}`} className={buttonVariants({ size: "lg" })}>
            {started ? t("today.continueSetup") : t("today.startHere")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Page>
  );
}
