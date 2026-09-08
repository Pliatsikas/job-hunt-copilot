"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ActionState } from "@/lib/applications/actions";
import { STATUSES, WORK_MODES } from "@/lib/schemas/application";
import { STATUS_LABELS } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm";

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
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="roleTitle">Role title</Label>
          <Input id="roleTitle" name="roleTitle" required defaultValue={defaults.roleTitle} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="companyName">Company</Label>
          <Input
            id="companyName"
            name="companyName"
            defaultValue={defaults.companyName}
            placeholder="Acme Ltd"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="jobDescription">Job description</Label>
        <Textarea
          id="jobDescription"
          name="jobDescription"
          required
          rows={12}
          defaultValue={defaults.jobDescription}
          placeholder="Paste the full posting here."
        />
        <p className="text-xs text-muted-foreground">
          Paste the whole posting — this is the text the analysis will read.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="jobUrl">Job URL</Label>
          <Input id="jobUrl" name="jobUrl" type="url" defaultValue={defaults.jobUrl} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="source">Source</Label>
          <Input
            id="source"
            name="source"
            defaultValue={defaults.source}
            placeholder="LinkedIn, kariera.gr, referral…"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={defaults.location} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="workMode">Work mode</Label>
          <select
            id="workMode"
            name="workMode"
            className={selectClass}
            defaultValue={defaults.workMode ?? "ONSITE"}
          >
            {WORK_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode.charAt(0) + mode.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            className={selectClass}
            defaultValue={defaults.status ?? "SAVED"}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="salaryNote">Salary note</Label>
          <Input id="salaryNote" name="salaryNote" defaultValue={defaults.salaryNote} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="appliedAt">Applied on</Label>
          <Input id="appliedAt" name="appliedAt" type="date" defaultValue={defaults.appliedAt} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nextActionAt">Next action</Label>
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
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
