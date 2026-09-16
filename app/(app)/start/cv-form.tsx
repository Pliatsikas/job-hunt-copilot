"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, FileUp } from "lucide-react";
import { saveCvFromStart, type StartState } from "@/lib/start/actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CvStepForm({ initial }: { initial: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<StartState, FormData>(saveCvFromStart, {});
  const [text, setText] = useState(initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Link
        href="/profile/import?next=/start/2"
        className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-8 text-center transition-colors hover:bg-accent/30 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <FileUp className="size-8 text-primary" aria-hidden />
        <span className="font-medium">{t("start.uploadPdf")}</span>
        <span className="text-sm text-muted-foreground">{t("start.uploadNote")}</span>
      </Link>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("start.orPaste")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Textarea
        name="cvText"
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("start.cvPlaceholder")}
        className="font-mono text-xs leading-relaxed"
        aria-label={t("profile.cvText")}
      />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{t("start.cvChangeLater")}</span>
        <Button type="submit" disabled={pending || text.trim().length < 200}>
          {pending ? t("common.saving") : t("common.continue")}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
