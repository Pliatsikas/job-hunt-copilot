"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  applyImportedCv,
  importCvFromPdf,
  type ApplyState,
  type ImportResult,
} from "@/lib/cv-import/actions";
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
          <Label htmlFor="pdf">PDF file</Label>
          <input
            id="pdf"
            name="pdf"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="block w-full text-sm file:mr-4 file:rounded-lg file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="text-xs text-muted-foreground">
            Up to {maxBytes / 1024 / 1024} MB. Needs a text layer — a scanned image has nothing
            to read. Uses one of your daily model calls.
          </p>
        </div>

        {result.error && (
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
        )}

        <div>
          <Button type="submit" disabled={importing}>
            {importing ? "Extracting and cleaning up…" : "Extract text"}
          </Button>
        </div>
        {importing && (
          <p role="status" className="text-xs text-muted-foreground">
            Reading the PDF, then asking the model to rewrite it one sentence per line. This
            takes a little while.
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
        <p className="font-medium">Review before saving</p>
        <ul className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
          <li>
            {draft.pages} {draft.pages === 1 ? "page" : "pages"},{" "}
            {draft.rawChars.toLocaleString("en-GB")} characters extracted
          </li>
          <li>
            {q.lines} lines, {q.quotableLines} long enough to be quoted as evidence
          </li>
          <li>
            Removed before anything left the server: {draft.redacted.emails}{" "}
            {draft.redacted.emails === 1 ? "email" : "emails"}, {draft.redacted.phones}{" "}
            {draft.redacted.phones === 1 ? "phone number" : "phone numbers"}
          </li>
          <li>
            Still worth a look: a street address or date of birth, which no pattern catches
            reliably
          </li>
        </ul>
        {q.fragmented && (
          <p role="alert" className="mt-3 text-destructive">
            Only {Math.round(q.quotableShare * 100)}% of lines are long enough to quote. This
            reads as a fragmented extraction — a two-column layout, usually. The analysis matches
            claims against these exact lines, so check that sentences are whole before saving,
            or paste the CV as text instead.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cvText">Extracted CV — edit anything that came out wrong</Label>
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
        <Button type="submit" disabled={applying}>
          {applying
            ? "Saving…"
            : hasExistingCv
              ? "Replace my CV with this"
              : "Save as my CV"}
        </Button>
        <Link href="/profile" className={buttonVariants({ variant: "ghost" })}>
          Discard
        </Link>
        {hasExistingCv && (
          <span className="text-xs text-muted-foreground">
            Your current CV is untouched until you click replace.
          </span>
        )}
      </div>
    </form>
  );
}
