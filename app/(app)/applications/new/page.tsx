import { createApplication } from "@/lib/applications/actions";
import { ApplicationForm } from "../application-form";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";

export default function NewApplicationPage() {
  return (
    <Page>
      <PageHeader title="Add application" description={<>Only the role and the job description are required.</>} />
      <div className="max-w-3xl">
        <ApplicationForm
          action={createApplication}
          submitLabel="Save application"
          cancelHref="/applications"
        />
      </div>
    </Page>
  );
}
