"use server";

import { revalidatePath } from "next/cache";
import { addCalendarDays, DEFAULT_TIME_ZONE } from "../dates";
import { db } from "../db";
import { SNOOZE_DAYS } from "./follow-up-policy";
import { requireOwnedApplication } from "./guards";

export type ReminderState = { error?: string };

export async function snoozeApplication(
  applicationId: string,
  _prevState: ReminderState,
  _formData: FormData,
): Promise<ReminderState> {
  try {
    const application = await requireOwnedApplication(applicationId);

    // Snooze from the later of now and the existing date. Measuring from an
    // overdue date would leave the item still overdue — a button that appears
    // to do nothing — while measuring purely from now would pull a
    // comfortably-future item closer.
    const now = new Date();
    const from =
      application.nextActionAt && application.nextActionAt > now
        ? application.nextActionAt
        : now;
    const nextActionAt = addCalendarDays(from, SNOOZE_DAYS, DEFAULT_TIME_ZONE);

    await db.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: { nextActionAt },
      });
      await tx.event.create({
        data: {
          applicationId: application.id,
          userId: application.userId,
          type: "NOTE",
          body: `Snoozed ${SNOOZE_DAYS} days`,
        },
      });
    });

    revalidatePath("/today");
    revalidatePath(`/applications/${application.id}`);
    return {};
  } catch (error) {
    console.error("Snooze failed:", error);
    return { error: "Couldn't snooze this one." };
  }
}

export async function markActionDone(
  applicationId: string,
  _prevState: ReminderState,
  _formData: FormData,
): Promise<ReminderState> {
  try {
    const application = await requireOwnedApplication(applicationId);

    await db.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: { nextActionAt: null },
      });
      await tx.event.create({
        data: {
          applicationId: application.id,
          userId: application.userId,
          type: "NOTE",
          // Recorded as activity, which is also what resets the staleness clock.
          body: "Marked the follow-up done",
        },
      });
    });

    revalidatePath("/today");
    revalidatePath(`/applications/${application.id}`);
    return {};
  } catch (error) {
    console.error("Mark done failed:", error);
    return { error: "Couldn't update this one." };
  }
}
