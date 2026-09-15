import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/profile/get";
import { CV_PDF_MAX_BYTES } from "@/lib/schemas/cv-import";
import { ImportForm } from "./import-form";

export const metadata: Metadata = {
  title: "Import CV from PDF",
  description: "Upload a CV as PDF, review the extracted text, then save it as your profile CV.",
};

export default async function ImportPage() {
  const profile = await getProfile();
  const hasCv = Boolean(profile?.cvText.trim());

  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Import CV from PDF</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-muted-foreground">
        The text is extracted, contact details are removed before anything is sent to a model,
        and one cleanup pass rewrites it one sentence per line so the analysis can quote from
        it. You review the result before it replaces anything.
        {hasCv && " Your current CV stays as it is until you save."}
      </p>

      <ImportForm maxBytes={CV_PDF_MAX_BYTES} hasExistingCv={hasCv} />

      <p className="mt-8 text-xs text-muted-foreground">
        Prefer to paste? <Link href="/profile" className="underline">Edit the CV as text</Link>{" "}
        instead.
      </p>
    </div>
  );
}
