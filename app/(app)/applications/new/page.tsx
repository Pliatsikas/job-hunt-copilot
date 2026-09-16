import { createApplication } from "@/lib/applications/actions";
import { getT } from "@/lib/i18n/server";
import { ApplicationForm } from "../application-form";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";

export default async function NewApplicationPage() {
  const t = await getT();
  return (
    <Page>
      <PageHeader title={t("applications.newTitle")} description={t("applications.newSub")} />
      <div className="max-w-3xl">
        <ApplicationForm action={createApplication} submitLabel={t("applications.saveApplication")} cancelHref="/applications" />
      </div>
    </Page>
  );
}
