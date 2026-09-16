"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  applyImportedCv,
  importCvFromPdf,
  type ApplyState,
  type ImportResult,
} from "@/lib/cv-import/actions";
import { useT } from "@/lib/i18n/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ImportForm({
  maxBytes,
  hasExistingCv,
  next,
}: {
  maxBytes: number;
  hasExistingCv: boolean;
  /** Where saving goes afterwards; unset means the profile page. */
  next?: string;
}) {
  const t = useT();
  const [result, importAction, importing] = useActionState<ImportResult, FormData>(
    importCvFromPdf,
    {},
  );
  const [applyState, applyAction, applying] = useActionState<ApplyState, FormData>(
    applyImportedCv,
    {},
  );
  // The draft is editable: the review screen is where a mangled line gets
  // fixed by a person, which is the whole reason it exists.
  const [text, setText] = useState<string | null>(null);
  const draft = result.draft;
  const shown = text ?? draft?.text ?? "";

  if (!draft) {
    return (
      <form action={importAction} className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pdf">{t("profileImport.file")}</Label>
          <input
            id="pdf"
            name="pdf"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="block w-full text-sm file:mr-4 file:rounded-lg file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="text-xs text-muted-foreground">{t("profileImport.fileNote", { mb: maxBytes / 1024 / 1024 })}</p>
        </div>

        {result.error && (
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
        )}

        <div>
          <Button type="submit" pending={importing}>
            {importing ? t("profileImport.extracting") : t("profileImport.extract")}
          </Button>
        </div>
        {importing && (
          <p role="status" className="text-xs text-muted-foreground">
            {t("profileImport.extractingNote")}
          </p>
        )}
      </form>
    );
  }

  const q = draft.quality;

  return (
    <form action={applyAction} className="flex max-w-3xl flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">{t("profileImport.review")}</p>
        <ul className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
          <li>{t("profileImport.pagesChars", { pages: draft.pages, chars: draft.rawChars.toLocaleString("en-GB") })}</li>
          <li>{t("profileImport.linesQuotable", { lines: q.lines, quotable: q.quotableLines })}</li>
          <li>{t("profileImport.removed", { emails: draft.redacted.emails, phones: draft.redacted.phones })}</li>
          <li>{t("profileImport.stillCheck")}</li>
        </ul>
        {q.fragmented && (
          <p role="alert" className="mt-3 text-destructive">
            {t("profileImport.fragmented", { percent: Math.round(q.quotableShare * 100) })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cvText">{t("profileImport.extracted")}</Label>
        <Textarea
          id="cvText"
          name="cvText"
          rows={24}
          value={shown}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-xs leading-relaxed"
        />
      </div>

      {applyState.error && (
        <p role="alert" className="text-sm text-destructive">
          {applyState.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" pending={applying}>
          {applying ? t("common.saving") : hasExistingCv ? t("profileImport.replace") : t("profileImport.saveAs")}
        </Button>
        <Link href={next ?? "/profile"} className={buttonVariants({ variant: "ghost" })}>
          {t("common.cancel")}
        </Link>
        {hasExistingCv && <span className="text-xs text-muted-foreground">{t("profileImport.subExisting")}</span>}
      </div>
    </form>
  );
}
