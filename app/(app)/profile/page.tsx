import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
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
  const [t, profile, prefs, { imported }] = await Promise.all([getT(), getProfile(), getJobPreferences(), searchParams]);

  return (
    <Page>
      <PageHeader title={t("profile.title")} description={profile ? t("profile.sub") : t("profile.subEmpty")} />

      {imported && (
        <p role="status" className="mb-4 max-w-2xl rounded-lg border bg-muted/30 p-3 text-sm">
          {t("profile.imported")}
        </p>
      )}

      <p className="mb-6 text-sm">
        <Link href="/profile/import" className="underline">
          {t("profile.importLink")}
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

      <div id="preferences" className="mt-10 scroll-mt-6">
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
