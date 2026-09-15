"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../auth";
import { db } from "../db";

/**
 * Promotion creates the Application the rest of the app already knows how to
 * handle — and carries the score across as an Analysis row through the same
 * shape the analyze action writes, so the person does not pay for the same
 * analysis twice. Rule 8 holds: the Application's denormalized score is set
 * here, in the same transaction as its Analysis, by the one code path that
 * creates both.
 */
export async function promoteLead(id: string): Promise<void> {
  const user = await requireUser();
  const lead = await db.lead.findFirst({ where: { id, userId: user.id, status: "NEW" } });
  if (!lead) return;

  const applicationId = await db.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { userId_name: { userId: user.id, name: lead.companyName } },
      update: {},
      create: { userId: user.id, name: lead.companyName },
    });
    const application = await tx.application.create({
      data: {
        userId: user.id,
        companyId: company.id,
        roleTitle: lead.roleTitle,
        jobDescription: lead.jobDescription,
        jobUrl: lead.jobUrl,
        location: lead.location,
        source: lead.source.toLowerCase(),
        status: "SAVED",
        ...(lead.matchScore !== null && lead.scoredAt
          ? { latestMatchScore: lead.matchScore, lastAnalyzedAt: lead.scoredAt }
          : {}),
      },
      select: { id: true },
    });
    if (lead.matchScore !== null && lead.analysis && lead.scoredAt) {
      await tx.analysis.create({
        data: {
          applicationId: application.id,
          userId: user.id,
          provider: "lead",
          model: "carried-over",
          promptVersion: "analyze@2",
          matchScore: lead.matchScore,
          result: lead.analysis,
          droppedClaims: lead.droppedClaims ?? 0,
          createdAt: lead.scoredAt,
        },
      });
    }
    await tx.event.create({
      data: {
        applicationId: application.id,
        userId: user.id,
        type: "NOTE",
        body: `Promoted from ${lead.source} lead${lead.matchScore !== null ? ` (scored ${lead.matchScore} on arrival)` : ""}`,
      },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "PROMOTED", applicationId: application.id },
    });
    return application.id;
  });

  revalidatePath("/leads");
  revalidatePath("/applications");
  redirect(`/applications/${applicationId}`);
}
