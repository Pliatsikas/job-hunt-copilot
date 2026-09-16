import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getUsageToday } from "@/lib/llm/usage";
import { getProfile } from "@/lib/profile/get";
import { getJobPreferences } from "@/lib/profile/preferences";
import { getSetupState } from "@/lib/start/setup";
import { Page } from "@/components/page";
import { PreferencesForm } from "../../profile/preferences-form";
import { CvStepForm } from "../cv-form";
import { FirstApplicationForm } from "../first-form";
import { Progress } from "../progress";

export const metadata: Metadata = { title: "Start" };
export const dynamic = "force-dynamic";

/**
 * The guide: three screens, one action each. Each step is its own URL so the
 * back button works and a half-done setup resumes where it stopped; Today
 * links to whichever step is next.
 */
export default async function StartPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ suggest?: string }>;
}) {
  const [{ step: raw }, { suggest }] = await Promise.all([params, searchParams]);
  const step = Number(raw);
  if (![1, 2, 3].includes(step)) notFound();

  const t = await getT();
  const setup = await getSetupState();
  // Cannot set preferences without a CV to suggest from; cannot paste a
  // first posting without both. Send them to the step they need.
  if (step === 2 && !setup.cv) redirect("/start/1");
  if (step === 3 && (!setup.cv || !setup.prefs)) redirect(setup.cv ? "/start/2" : "/start/1");

  const titles = { 1: t("start.cvTitle"), 2: t("start.prefsTitle"), 3: t("start.firstTitle") } as const;
  const subs = { 1: t("start.cvSub"), 2: t("start.prefsSub"), 3: t("start.firstSub") } as const;
  const s = step as 1 | 2 | 3;

  return (
    <Page>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Progress step={s} label={t("start.stepOf", { step: s })} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{titles[s]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subs[s]}</p>
        </div>
        {s === 1 && <CvStepForm initial={(await getProfile())?.cvText ?? ""} />}
        {s === 2 && <Step2 autoSuggest={suggest === "1"} />}
        {s === 3 && <Step3 />}
      </div>
    </Page>
  );
}

async function Step2({ autoSuggest }: { autoSuggest: boolean }) {
  const [profile, prefs] = await Promise.all([getProfile(), getJobPreferences()]);
  return (
    <PreferencesForm
      hasCv={Boolean(profile?.cvText.trim())}
      autoSuggest={autoSuggest}
      nextHref="/start/3"
      defaults={{
        targetRoles: prefs?.targetRoles ?? [],
        city: prefs?.city ?? "",
        country: prefs?.country ?? "",
        remote: prefs?.remote ?? "ANY",
        seniority: prefs?.seniority ?? "",
        languages: prefs?.languages ?? ["el", "en"],
        excludeKeywords: prefs?.excludeKeywords ?? [],
        autoSearch: prefs?.autoSearch ?? true,
      }}
    />
  );
}

async function Step3() {
  const user = await requireUser();
  const usage = await getUsageToday(user.id);
  return <FirstApplicationForm callsLeft={Math.max(0, usage.limits.requests - usage.requests)} limit={usage.limits.requests} />;
}
