import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { CaptureForm } from "./capture-form";

export const metadata: Metadata = {
  title: "Save this job",
  description: "Review what the bookmarklet picked up, then save it as a lead.",
};

/**
 * The bookmarklet's landing page. The payload is in the URL fragment, which
 * the server never sees — this page renders empty and the client component
 * reads window.location.hash. That is by design: the posting text goes from
 * the person's browser to our form to our action, and nowhere else.
 */
export default async function CapturePage() {
  const t = await getT();
  return (
    <Page>
      <PageHeader title={t("jobs.captureTitle")} description={t("jobs.captureSub")} />
      <CaptureForm />
    </Page>
  );
}
