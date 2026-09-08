"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { db } from "../db";
import { profileFormSchema } from "../schemas/profile";

export type ProfileState = { error?: string; savedAt?: number };

export async function saveProfile(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();

  const parsed = profileFormSchema.safeParse({
    headline: formData.get("headline"),
    location: formData.get("location"),
    yearsOfExp: formData.get("yearsOfExp"),
    cvText: formData.get("cvText"),
    skills: formData.getAll("skills"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { headline, location, yearsOfExp, cvText, skills } = parsed.data;

  await db.profile.upsert({
    where: { userId: user.id },
    update: { headline, location, yearsOfExp, cvText, skills },
    create: { userId: user.id, headline, location, yearsOfExp, cvText, skills },
  });

  revalidatePath("/profile");
  // Stays on the page — this is a form you come back and edit, not a wizard.
  return { savedAt: Date.now() };
}
