"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  saveJobPreferences,
  suggestJobPreferences,
  type PreferencesState,
  type SuggestState,
} from "@/lib/profile/preferences";
import { useT } from "@/lib/i18n/client";
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
  autoSuggest = false,
  nextHref,
}: {
  defaults: PreferencesDefaults;
  hasCv: boolean;
  /** Ask the model on mount when the roles are still empty — the guide does this so step 2 arrives pre-filled. */
  autoSuggest?: boolean;
  /** Where saving goes afterwards. Unset: stay here and confirm. */
  nextHref?: string;
}) {
  const t = useT();
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

  const suggestFormRef = useRef<HTMLFormElement>(null);
  const askedRef = useRef(false);
  useEffect(() => {
    if (!autoSuggest || !hasCv || askedRef.current || defaults.targetRoles.length) return;
    askedRef.current = true;
    // Drop the flag from the URL so a reload does not ask again.
    window.history.replaceState(null, "", window.location.pathname);
    suggestFormRef.current?.requestSubmit();
  }, [autoSuggest, hasCv, defaults.targetRoles.length]);

  const inGuide = Boolean(nextHref);

  return (
    <div className={inGuide ? "flex flex-col gap-4" : "flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {!inGuide && (
          <div>
            <h2 className="text-base font-semibold">{t("profile.prefsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("profile.prefsSub")}</p>
          </div>
        )}
        <form action={suggestAction} ref={suggestFormRef}>
          <Button type="submit" variant="secondary" size="sm" pending={suggesting} disabled={!hasCv}>
            {!suggesting && <Sparkles className="size-4" aria-hidden />}
            {suggesting ? t("profile.suggesting") : t("profile.suggest")}
          </Button>
        </form>
      </div>
      {!hasCv && <p className="text-xs text-muted-foreground">{t("profile.suggestNeedsCv")}</p>}
      {suggest.error && (
        <p role="alert" className="text-sm text-destructive">
          {suggest.error}
        </p>
      )}
      {suggest.suggestion && (
        <p role="status" className="rounded-lg border bg-accent/40 p-3 text-sm animate-in fade-in slide-in-from-top-1 duration-300">
          {suggest.suggestion.rationale} {t("profile.suggestFilled")}
        </p>
      )}

      <form action={save} className="flex flex-col gap-4">
        {nextHref && <input type="hidden" name="next" value={nextHref} />}
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetRoles">{t("profile.roles")}</Label>
          <ChipsEditor
            id="targetRoles"
            name="targetRoles"
            value={roles}
            onChange={setRoles}
            placeholder={t("profile.rolesPlaceholder")}
            max={MAX_TARGET_ROLES}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="city">{t("profile.city")}</Label>
            <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Thessaloniki" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="country">{t("profile.country")}</Label>
            <Input id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Greece" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="remote">{t("profile.remote")}</Label>
            <select id="remote" name="remote" defaultValue={defaults.remote} className={selectClass}>
              {REMOTE_PREFERENCES.map((v) => (
                <option key={v} value={v}>
                  {t(`profile.remoteOptions.${v}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="seniority">{t("profile.seniority")}</Label>
            <select id="seniority" name="seniority" value={seniority} onChange={(e) => setSeniority(e.target.value)} className={selectClass}>
              <option value="">{t("profile.seniorityUnsure")}</option>
              {SENIORITIES.map((v) => (
                <option key={v} value={v}>
                  {t(`profile.seniorityOptions.${v}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("profile.languages")}</legend>
          <div className="flex gap-4">
            {POSTING_LANGUAGES.map((lang) => (
              <label key={lang} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="languages" value={lang} defaultChecked={defaults.languages.includes(lang)} className="size-4 accent-primary" />
                {t(`profile.languageOptions.${lang}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="excludeKeywords">{t("profile.exclude")}</Label>
          <ChipsEditor id="excludeKeywords" name="excludeKeywords" value={exclude} onChange={setExclude} placeholder={t("profile.excludePlaceholder")} max={20} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="autoSearch" defaultChecked={defaults.autoSearch} className="size-4 accent-primary" />
          {t("profile.autoSearch")}
          <span className="text-xs text-muted-foreground">{t("profile.autoSearchNote")}</span>
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.savedAt && !state.error && (
          <p role="status" className="text-sm text-muted-foreground animate-in fade-in duration-300">
            {t("profile.prefsSaved")}
          </p>
        )}

        <div className={inGuide ? "flex justify-end" : ""}>
          <Button type="submit" pending={saving}>
            {saving ? t("common.saving") : inGuide ? t("common.continue") : t("profile.savePrefs")}
            {inGuide && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </div>
      </form>
    </div>
  );
}
