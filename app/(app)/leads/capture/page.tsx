import type { Metadata } from "next";
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
export default function CapturePage() {
  return (
    <Page>
      <PageHeader
        title="Save this job"
        description="From the page you were on. Check the title and company, then save — it joins your list ranked like the rest."
      />
      <CaptureForm />
    </Page>
  );
}
