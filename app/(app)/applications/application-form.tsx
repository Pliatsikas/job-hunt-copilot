"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ActionState } from "@/lib/applications/actions";
import { STATUSES, WORK_MODES } from "@/lib/schemas/application";
import { useT } from "@/lib/i18n/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_FOCUS } from "@/components/ui/select-focus";
import { Textarea } from "@/components/ui/textarea";

export type ApplicationFormDefaults = {
  roleTitle?: string;
  companyName?: string;
  jobUrl?: string;
  jobDescription?: string;
  source?: string;
  location?: string;
  workMode?: string;
  salaryNote?: string;
  status?: string;
  appliedAt?: string;
  nextActionAt?: string;
};

const selectClass =
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm" +
  // Matches the focus ring on Input/Textarea. A native select keeps the
  // browser default otherwise, which differs per platform and is the one
  // control in a form that looks unfocusable next to the others.
  SELECT_FOCUS;

export function ApplicationForm({
  action,
  defaults = {},
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: ApplicationFormDefaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="roleTitle">{t("applications.form.roleTitle")}</Label>
          <Input id="roleTitle" name="roleTitle" required defaultValue={defaults.roleTitle} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="companyName">{t("applications.form.companyName")}</Label>
          <Input
            id="companyName"
            name="companyName"
            defaultValue={defaults.companyName}
            placeholder="Acme Ltd"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="jobDescription">{t("applications.form.jobDescription")}</Label>
        <Textarea
          id="jobDescription"
          name="jobDescription"
          required
          rows={12}
          defaultValue={defaults.jobDescription}
          placeholder={t("applications.form.jobDescriptionPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("applications.form.jobDescriptionNote")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="jobUrl">{t("applications.form.jobUrl")}</Label>
          <Input id="jobUrl" name="jobUrl" type="url" defaultValue={defaults.jobUrl} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="source">{t("applications.form.source")}</Label>
          <Input
            id="source"
            name="source"
            defaultValue={defaults.source}
            placeholder={t("applications.form.sourcePlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location">{t("applications.form.location")}</Label>
          <Input id="location" name="location" defaultValue={defaults.location} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="workMode">{t("applications.form.workMode")}</Label>
          <select
            id="workMode"
            name="workMode"
            className={selectClass}
            defaultValue={defaults.workMode ?? "ONSITE"}
          >
            {WORK_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`application.workMode.${mode}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">{t("applications.form.status")}</Label>
          <select
            id="status"
            name="status"
            className={selectClass}
            defaultValue={defaults.status ?? "SAVED"}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`application.statuses.${status}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="salaryNote">{t("applications.form.salaryNote")}</Label>
          <Input id="salaryNote" name="salaryNote" defaultValue={defaults.salaryNote} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="appliedAt">{t("applications.form.appliedAt")}</Label>
          <Input id="appliedAt" name="appliedAt" type="date" defaultValue={defaults.appliedAt} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nextActionAt">{t("applications.form.nextActionAt")}</Label>
          <Input
            id="nextActionAt"
            name="nextActionAt"
            type="date"
            defaultValue={defaults.nextActionAt}
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" pending={pending}>
          {pending ? t("common.saving") : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
