import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getProfile } from "@/lib/profile/get";
import { CV_PDF_MAX_BYTES } from "@/lib/schemas/cv-import";
import { ImportForm } from "./import-form";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Import CV from PDF",
  description: "Upload a CV as PDF, review the extracted text, then save it as your profile CV.",
};

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [t, profile, { next }] = await Promise.all([getT(), getProfile(), searchParams]);
  const hasCv = Boolean(profile?.cvText.trim());
  const safeNext = next?.startsWith("/") ? next : undefined;

  return (
    <Page>
      <PageHeader title={t("profileImport.title")} description={<>{t("profileImport.sub")}{hasCv && ` ${t("profileImport.subExisting")}`}</>} />

      <ImportForm maxBytes={CV_PDF_MAX_BYTES} hasExistingCv={hasCv} next={safeNext} />

      <p className="mt-8 text-xs text-muted-foreground">
        {t("profileImport.preferPaste")}{" "}
        <Link href={safeNext ? "/start/1" : "/profile"} className="underline">
          {t("profileImport.editAsText")}
        </Link>
      </p>
    </Page>
  );
}
