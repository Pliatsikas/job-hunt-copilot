"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { captureLead, type IngestState } from "@/lib/ingest/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Payload = { t: string; u: string; b: string };

function readPayload(): Payload | null {
  try {
    const raw = window.location.hash.slice(1);
    if (!raw) return null;
    const p = JSON.parse(decodeURIComponent(raw)) as Partial<Payload>;
    if (typeof p.u !== "string" || typeof p.b !== "string") return null;
    return { t: String(p.t ?? ""), u: p.u, b: p.b };
  } catch {
    return null;
  }
}

/**
 * Guesses the company from the title's usual shapes ("Role at Company",
 * "Role - Company", "Role | Company"); the person corrects it if wrong.
 */
function guessCompany(title: string): string {
  const m = title.match(/\s(?:at|@|-|–|—|\|)\s+([^|–—-]{2,60})$/i);
  return m ? m[1].trim() : "";
}

export function CaptureForm() {
  const [state, action, pending] = useActionState<IngestState, FormData>(captureLead, {});
  const [payload, setPayload] = useState<Payload | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");

  useEffect(() => {
    const p = readPayload();
    setPayload(p);
    if (p) {
      setTitle(p.t.slice(0, 200));
      setCompany(guessCompany(p.t));
    }
  }, []);

  if (payload === undefined) return <p className="text-sm text-muted-foreground">Reading the page…</p>;

  if (payload === null) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm">
        <p>Nothing to save — this page is opened by the bookmarklet.</p>
        <Link href="/leads" className={`${buttonVariants({ variant: "secondary" })} mt-4`}>
          Back to Jobs for you
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="url" value={payload.u} />
      <input type="hidden" name="text" value={payload.b} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Role</Label>
        <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="company">Company</Label>
        <Input id="company" name="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="If the title didn't say" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="preview">Page text ({payload.b.length.toLocaleString("en-GB")} characters)</Label>
        <Textarea id="preview" readOnly value={payload.b.slice(0, 1200) + (payload.b.length > 1200 ? "\n…" : "")} rows={10} className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground">
          Everything on the page, including navigation — the analysis reads through that fine.
          From <span className="font-mono">{new URL(payload.u).hostname}</span>.
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save as a lead"}
        </Button>
        <Link href="/leads" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
