"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAnalysis } from "../analysis/run";
import { recordAnalysis } from "../applications/record-analysis";
import { requireUser } from "../auth";
import { db } from "../db";
import { getT } from "../i18n/server";

export type StartState = { error?: string };

/**
 * Step 1 of the guide: just the CV. The full profile form still exists on
 * /profile; the guide asks for the one thing everything else needs and
 * leaves headline, location and skills for later — the analysis works
 * without them, and three fields on the first screen are three reasons to
 * stop.
 */
export async function saveCvFromStart(_prev: StartState, formData: FormData): Promise<StartState> {
  const user = await requireUser();
  const t = await getT();
  const parsed = z.string().trim().min(200).safeParse(formData.get("cvText"));
  if (!parsed.success) return { error: t("profile.cvThin", { min: 800 }) };

  await db.profile.upsert({
    where: { userId: user.id },
    update: { cvText: parsed.data },
    create: { userId: user.id, cvText: parsed.data, skills: [] },
  });
  revalidatePath("/profile");
  revalidatePath("/today");
  redirect("/start/2");
}

const firstSchema = z.object({
  roleTitle: z.string().trim().min(1).max(120),
  companyName: z.string().trim().max(120).optional(),
  jobDescription: z.string().trim().min(80),
});

/**
 * Step 3: paste a posting, and the one button creates the application AND
 * runs the analysis, so the person lands on a result rather than on another
 * button. If the analysis cannot run (budget, provider), the application is
 * still created and its page offers the button — nothing is lost, and the
 * error is the one the analysis would have shown.
 */
export async function startFirstApplication(_prev: StartState, formData: FormData): Promise<StartState> {
  const user = await requireUser();
  const t = await getT();
  const parsed = firstSchema.safeParse({
    roleTitle: formData.get("roleTitle"),
    companyName: formData.get("companyName") || undefined,
    jobDescription: formData.get("jobDescription"),
  });
  if (!parsed.success) return { error: t("common.somethingFailed") };
  const { roleTitle, companyName, jobDescription } = parsed.data;

  const company = companyName
    ? await db.company.upsert({
        where: { userId_name: { userId: user.id, name: companyName } },
        update: {},
        create: { userId: user.id, name: companyName },
        select: { id: true },
      })
    : null;

  const application = await db.application.create({
    data: { userId: user.id, companyId: company?.id ?? null, roleTitle, jobDescription, status: "SAVED" },
    select: { id: true },
  });

  const profile = await db.profile.findUnique({ where: { userId: user.id } });
  if (profile?.cvText.trim()) {
    try {
      const run = await runAnalysis({ userId: user.id, cvText: profile.cvText, skills: profile.skills, jobDescription });
      await recordAnalysis(application.id, user.id, run);
    } catch (error) {
      // The application exists; the page it lands on has the analyse button
      // and will show the same error. Logged, not swallowed.
      console.error("First analysis from the guide failed:", error);
    }
  }

  revalidatePath("/applications");
  revalidatePath("/today");
  redirect(`/applications/${application.id}`);
}
