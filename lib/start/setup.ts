import { requireUser } from "../auth";
import { db } from "../db";

export type SetupState = {
  cv: boolean;
  prefs: boolean;
  firstApplication: boolean;
  /** 1, 2, 3, or null when everything is done. */
  nextStep: 1 | 2 | 3 | null;
};

/** Where a person is in the three-step guide. Cheap: three existence checks. */
export async function getSetupState(): Promise<SetupState> {
  const user = await requireUser();
  const [profile, prefs, app] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id }, select: { cvText: true } }),
    db.jobPreferences.findUnique({ where: { userId: user.id }, select: { targetRoles: true } }),
    db.application.findFirst({ where: { userId: user.id }, select: { id: true } }),
  ]);
  const cv = Boolean(profile?.cvText.trim());
  const hasPrefs = Boolean(prefs && prefs.targetRoles.length);
  const firstApplication = Boolean(app);
  const nextStep = !cv ? 1 : !hasPrefs ? 2 : !firstApplication ? 3 : null;
  return { cv, prefs: hasPrefs, firstApplication, nextStep };
}
