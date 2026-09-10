"use client";

import { useActionState } from "react";
import { saveProfile, type ProfileState } from "@/lib/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CvTextarea } from "./cv-textarea";
import { SKILLS_INPUT_ID, SkillsEditor } from "./skills-editor";

export type ProfileDefaults = {
  headline: string;
  location: string;
  yearsOfExp: number;
  cvText: string;
  skills: string[];
};

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(saveProfile, {});

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            name="headline"
            defaultValue={defaults.headline}
            placeholder="Junior Fullstack Developer"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="yearsOfExp">Years of experience</Label>
          <Input
            id="yearsOfExp"
            name="yearsOfExp"
            type="number"
            min={0}
            max={70}
            defaultValue={defaults.yearsOfExp}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={defaults.location}
            placeholder="Thessaloniki, Greece"
          />
        </div>
      </div>

      <CvTextarea initial={defaults.cvText} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={SKILLS_INPUT_ID}>Skills</Label>
        <SkillsEditor initial={defaults.skills} />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.savedAt && !state.error && (
        <p role="status" className="text-sm text-muted-foreground">
          Profile saved.
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
