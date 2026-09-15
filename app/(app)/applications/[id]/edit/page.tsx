import { notFound } from "next/navigation";
import { updateApplication } from "@/lib/applications/actions";
import { requireOwnedApplication } from "@/lib/applications/guards";
import { toDateInputValue } from "@/lib/format";
import { ApplicationForm } from "../../application-form";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const application = await requireOwnedApplication(id).catch(() => null);
  if (!application) notFound();

  return (
    <Page>
      <PageHeader title="Edit application" description={<>Changing the status here records it on the timeline.</>} />
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
    </Page>
  );
}
