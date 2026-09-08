import { getProfile } from "@/lib/profile/get";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Profile</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-muted-foreground">
        {profile
          ? "Everything the analysis knows about you comes from here."
          : "Fill this in first — the analysis compares job descriptions against your CV text, so without it there is nothing to compare."}
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
