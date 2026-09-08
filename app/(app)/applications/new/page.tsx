import { createApplication } from "@/lib/applications/actions";
import { ApplicationForm } from "../application-form";

export default function NewApplicationPage() {
  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Add application</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Only the role and the job description are required.
      </p>
      <div className="max-w-3xl">
        <ApplicationForm
          action={createApplication}
          submitLabel="Save application"
          cancelHref="/applications"
        />
      </div>
    </div>
  );
}
