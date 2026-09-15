import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/profile/get";
import { CV_PDF_MAX_BYTES } from "@/lib/schemas/cv-import";
import { ImportForm } from "./import-form";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Import CV from PDF",
  description: "Upload a CV as PDF, review the extracted text, then save it as your profile CV.",
};

export default async function ImportPage() {
  const profile = await getProfile();
  const hasCv = Boolean(profile?.cvText.trim());

  return (
    <Page>
      <PageHeader title="Import CV from PDF" description={<>The text is extracted, contact details are removed before anything is sent to a model,
        and one cleanup pass rewrites it one sentence per line so the analysis can quote from
        it. You review the result before it replaces anything.
        {hasCv && " Your current CV stays as it is until you save."}</>} />

      <ImportForm maxBytes={CV_PDF_MAX_BYTES} hasExistingCv={hasCv} />

      <p className="mt-8 text-xs text-muted-foreground">
        Prefer to paste? <Link href="/profile" className="underline">Edit the CV as text</Link>{" "}
        instead.
      </p>
    </Page>
  );
}
