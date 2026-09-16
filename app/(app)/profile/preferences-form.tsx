"use client";

import { useActionState, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  saveJobPreferences,
  suggestJobPreferences,
  type PreferencesState,
  type SuggestState,
} from "@/lib/profile/preferences";
import {
  POSTING_LANGUAGES,
  REMOTE_PREFERENCES,
  SENIORITIES,
  MAX_TARGET_ROLES,
} from "@/lib/schemas/job-preferences";
import { ChipsEditor } from "@/components/chips-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_FOCUS } from "@/components/ui/select-focus";

const selectClass = "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm" + SELECT_FOCUS;

const REMOTE_LABELS: Record<(typeof REMOTE_PREFERENCES)[number], string> = {
  REMOTE_ONLY: "Remote only",
  REMOTE_OK: "Remote or local",
  ONSITE_OK: "Local (on-site or hybrid)",
  ANY: "Anything",
};
const SENIORITY_LABELS: Record<(typeof SENIORITIES)[number], string> = {
  JUNIOR: "Junior",
  MID: "Mid",
  SENIOR: "Senior",
};
const LANGUAGE_LABELS: Record<(typeof POSTING_LANGUAGES)[number], string> = {
  el: "Greek",
  en: "English",
};

export type PreferencesDefaults = {
  targetRoles: string[];
  city: string;
  country: string;
  remote: (typeof REMOTE_PREFERENCES)[number];
  seniority: (typeof SENIORITIES)[number] | "";
  languages: string[];
  excludeKeywords: string[];
  autoSearch: boolean;
};

export function PreferencesForm({
  defaults,
  hasCv,
}: {
  defaults: PreferencesDefaults;
  hasCv: boolean;
}) {
  const [state, save, saving] = useActionState<PreferencesState, FormData>(saveJobPreferences, {});
  const [suggest, suggestAction, suggesting] = useActionState<SuggestState, FormData>(
    suggestJobPreferences,
    {},
  );

  const [roles, setRoles] = useState(defaults.targetRoles);
  const [exclude, setExclude] = useState(defaults.excludeKeywords);
  const [city, setCity] = useState(defaults.city);
  const [country, setCountry] = useState(defaults.country);
  const [seniority, setSeniority] = useState<string>(defaults.seniority);

  // The suggestion fills what is empty and leaves what the owner typed. It
  // never saves: that is the save button's job, after a look.
  useEffect(() => {
    const s = suggest.suggestion;
    if (!s) return;
    setRoles((current) => (current.length ? current : s.targetRoles));
    setCity((current) => current || s.city || "");
    setCountry((current) => current || s.country || "");
    setSeniority((current) => current || s.seniority || "");
  }, [suggest.suggestion]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">What I&apos;m looking for</h2>
          <p className="text-sm text-muted-foreground">
            Turns into the searches that fill your Leads. Start from your CV and adjust.
          </p>
        </div>
        <form action={suggestAction}>
          <Button type="submit" variant="secondary" size="sm" disabled={suggesting || !hasCv}>
            <Sparkles className="size-4" aria-hidden />
            {suggesting ? "Reading your CV…" : "Suggest from my CV"}
          </Button>
        </form>
      </div>
      {!hasCv && (
        <p className="text-xs text-muted-foreground">Add your CV text above first — the suggestion reads it.</p>
      )}
      {suggest.error && (
        <p role="alert" className="text-sm text-destructive">
          {suggest.error}
        </p>
      )}
      {suggest.suggestion && (
        <p role="status" className="rounded-lg border bg-accent/40 p-3 text-sm">
          {suggest.suggestion.rationale} — filled in below where you had nothing yet. Nothing is
          saved until you click save.
        </p>
      )}

      <form action={save} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetRoles">Roles to search for</Label>
          <ChipsEditor
            id="targetRoles"
            name="targetRoles"
            value={roles}
            onChange={setRoles}
            placeholder="e.g. fullstack developer — Enter to add"
            max={MAX_TARGET_ROLES}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Thessaloniki" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Greece" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="remote">Remote</Label>
            <select id="remote" name="remote" defaultValue={defaults.remote} className={selectClass}>
              {REMOTE_PREFERENCES.map((v) => (
                <option key={v} value={v}>
                  {REMOTE_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="seniority">Seniority</Label>
            <select id="seniority" name="seniority" value={seniority} onChange={(e) => setSeniority(e.target.value)} className={selectClass}>
              <option value="">Not sure</option>
              {SENIORITIES.map((v) => (
                <option key={v} value={v}>
                  {SENIORITY_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Posting languages</legend>
          <div className="flex gap-4">
            {POSTING_LANGUAGES.map((lang) => (
              <label key={lang} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="languages" value={lang} defaultChecked={defaults.languages.includes(lang)} className="size-4 accent-primary" />
                {LANGUAGE_LABELS[lang]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="excludeKeywords">Skip postings mentioning</Label>
          <ChipsEditor id="excludeKeywords" name="excludeKeywords" value={exclude} onChange={setExclude} placeholder="e.g. sales, unpaid — Enter to add" max={20} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="autoSearch" defaultChecked={defaults.autoSearch} className="size-4 accent-primary" />
          Search for me automatically
          <span className="text-xs text-muted-foreground">(daily, once that ships)</span>
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.savedAt && !state.error && (
          <p role="status" className="text-sm text-muted-foreground">
            Preferences saved.
          </p>
        )}

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </form>
    </div>
  );
}
