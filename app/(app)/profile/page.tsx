import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/profile/get";
import { ProfileForm } from "./profile-form";

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
  const profile = await getProfile();
  const { imported } = await searchParams;

  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Profile</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-muted-foreground">
        {profile
          ? "Everything the analysis knows about you comes from here."
          : "Fill this in first — the analysis compares job descriptions against your CV text, so without it there is nothing to compare."}
      </p>

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
    </div>
  );
}
