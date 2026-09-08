import { notFound } from "next/navigation";
import { updateApplication } from "@/lib/applications/actions";
import { requireOwnedApplication } from "@/lib/applications/guards";
import { toDateInputValue } from "@/lib/format";
import { ApplicationForm } from "../../application-form";

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const application = await requireOwnedApplication(id).catch(() => null);
  if (!application) notFound();

  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Edit application</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Changing the status here records it on the timeline.
      </p>
      <div className="max-w-3xl">
        <ApplicationForm
          action={updateApplication.bind(null, application.id)}
          submitLabel="Save changes"
          cancelHref={`/applications/${application.id}`}
          defaults={{
            roleTitle: application.roleTitle,
            companyName: application.company?.name ?? "",
            jobUrl: application.jobUrl ?? "",
            jobDescription: application.jobDescription,
            source: application.source ?? "",
            location: application.location ?? "",
            workMode: application.workMode,
            salaryNote: application.salaryNote ?? "",
            status: application.status,
            appliedAt: toDateInputValue(application.appliedAt),
            nextActionAt: toDateInputValue(application.nextActionAt),
          }}
        />
      </div>
    </div>
  );
}
