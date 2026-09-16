import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/profile/get";
import { ProfileForm } from "./profile-form";
import { PreferencesForm } from "./preferences-form";
import { getJobPreferences } from "@/lib/profile/preferences";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Profile",
  description:
    "Your CV and skills — the source of truth every analysis and letter is grounded in.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const [profile, prefs] = await Promise.all([getProfile(), getJobPreferences()]);
  const { imported } = await searchParams;

  return (
    <Page>
      <PageHeader title="Profile" description={<>{profile
          ? "Everything the analysis knows about you comes from here."
          : "Fill this in first — the analysis compares job descriptions against your CV text, so without it there is nothing to compare."}</>} />

      {imported && (
        <p role="status" className="mb-4 max-w-2xl rounded-lg border bg-muted/30 p-3 text-sm">
          CV imported from PDF and saved. Run an analysis on an application to check it finds
          evidence — that is the real test of an import.
        </p>
      )}

      <p className="mb-6 text-sm">
        <Link href="/profile/import" className="underline">
          Import from a PDF instead
        </Link>
      </p>

      <ProfileForm
        defaults={{
          headline: profile?.headline ?? "",
          location: profile?.location ?? "",
          yearsOfExp: profile?.yearsOfExp ?? 0,
          cvText: profile?.cvText ?? "",
          skills: profile?.skills ?? [],
        }}
      />

      <div className="mt-10">
        <PreferencesForm
          hasCv={Boolean(profile?.cvText.trim())}
          defaults={{
            targetRoles: prefs?.targetRoles ?? [],
            city: prefs?.city ?? "",
            country: prefs?.country ?? "",
            remote: prefs?.remote ?? "ANY",
            seniority: prefs?.seniority ?? "",
            languages: prefs?.languages ?? ["el", "en"],
            excludeKeywords: prefs?.excludeKeywords ?? [],
            autoSearch: prefs?.autoSearch ?? true,
          }}
        />
      </div>
    </Page>
  );
}
