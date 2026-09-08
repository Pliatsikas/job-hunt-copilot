"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../auth";
import { db } from "../db";
import {
  applicationFormSchema,
  noteSchema,
  statusChangeSchema,
} from "../schemas/application";
import { requireOwnedApplication } from "./guards";

export type ActionState = { error?: string };

function readForm(formData: FormData) {
  return {
    roleTitle: formData.get("roleTitle"),
    companyName: formData.get("companyName"),
    jobUrl: formData.get("jobUrl"),
    jobDescription: formData.get("jobDescription"),
    source: formData.get("source"),
    location: formData.get("location"),
    workMode: formData.get("workMode"),
    salaryNote: formData.get("salaryNote"),
    status: formData.get("status"),
    appliedAt: formData.get("appliedAt"),
    nextActionAt: formData.get("nextActionAt"),
  };
}

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input";
}

/** Companies are per-user and keyed by name — reuse rather than duplicate. */
async function resolveCompanyId(userId: string, name: string | null) {
  if (!name) return null;
  const company = await db.company.upsert({
    where: { userId_name: { userId, name } },
    update: {},
    create: { userId, name },
    select: { id: true },
  });
  return company.id;
}

export async function createApplication(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = applicationFormSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { companyName, ...values } = parsed.data;

  const companyId = await resolveCompanyId(user.id, companyName);

  const created = await db.application.create({
    data: { ...values, userId: user.id, companyId },
    select: { id: true },
  });

  revalidatePath("/applications");
  redirect(`/applications/${created.id}`);
}

export async function updateApplication(
  applicationId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const existing = await requireOwnedApplication(applicationId);

  const parsed = applicationFormSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { companyName, ...values } = parsed.data;

  const companyId = await resolveCompanyId(existing.userId, companyName);
  const statusChanged = values.status !== existing.status;

  // The status change and its Event row land together or not at all.
  await db.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: existing.id },
      data: { ...values, companyId },
    });

    if (statusChanged) {
      await tx.event.create({
        data: {
          applicationId: existing.id,
          userId: existing.userId, // denormalized from the parent, same write
          type: "STATUS_CHANGE",
          fromStatus: existing.status,
          toStatus: values.status,
        },
      });
    }
  });

  revalidatePath("/applications");
  revalidatePath(`/applications/${existing.id}`);
  redirect(`/applications/${existing.id}`);
}

export async function changeStatus(
  applicationId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const existing = await requireOwnedApplication(applicationId);

  const parsed = statusChangeSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  if (parsed.data.status === existing.status) return {};

  await db.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: existing.id },
      data: { status: parsed.data.status },
    });
    await tx.event.create({
      data: {
        applicationId: existing.id,
        userId: existing.userId,
        type: "STATUS_CHANGE",
        fromStatus: existing.status,
        toStatus: parsed.data.status,
      },
    });
  });

  revalidatePath("/applications");
  revalidatePath(`/applications/${existing.id}`);
  return {};
}

export async function addNote(
  applicationId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const existing = await requireOwnedApplication(applicationId);

  const parsed = noteSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await db.event.create({
    data: {
      applicationId: existing.id,
      userId: existing.userId,
      type: "NOTE",
      body: parsed.data.body,
    },
  });

  revalidatePath(`/applications/${existing.id}`);
  return {};
}
