"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { startFirstApplication, type StartState } from "@/lib/start/actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function FirstApplicationForm({ callsLeft, limit }: { callsLeft: number; limit: number }) {
  const t = useT();
  const [state, action, pending] = useActionState<StartState, FormData>(startFirstApplication, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="roleTitle">{t("start.roleLabel")}</Label>
          <Input id="roleTitle" name="roleTitle" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="companyName">{t("start.companyLabel")}</Label>
          <Input id="companyName" name="companyName" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="jobDescription">{t("start.jdLabel")}</Label>
        <Textarea id="jobDescription" name="jobDescription" rows={12} required placeholder={t("start.jdPlaceholder")} />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/today" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t("start.skipForNow")}
        </Link>
        <div className="flex flex-col items-end gap-1">
          <Button type="submit" disabled={pending} size="lg">
            <Sparkles className="size-4" aria-hidden />
            {pending ? t("application.analysing") : t("start.analyseNow")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("common.callsToday", { used: limit - callsLeft, limit })}</span>
        </div>
      </div>
    </form>
  );
}
