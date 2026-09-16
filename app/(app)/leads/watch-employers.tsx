"use client";

import { useActionState } from "react";
import { unwatchEmployer, watchEmployer, type IngestState } from "@/lib/ingest/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_FOCUS } from "@/components/ui/select-focus";

const selectClass = "h-9 rounded-lg border border-border bg-background px-2.5 text-sm" + SELECT_FOCUS;

export function WatchEmployers({
  curated,
  own,
}: {
  curated: { name: string; source: string; greekJobs: number; checkedOn: string }[];
  own: { id: string; name: string; source: string; query: string }[];
}) {
  const [state, action, pending] = useActionState<IngestState, FormData>(watchEmployer, {});

  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        Employers we watch ({curated.length + own.length})
      </summary>
      <div className="flex flex-col gap-4 border-t px-4 py-4 text-sm">
        <p className="text-muted-foreground">
          Every search reads these boards directly through their public APIs. The starter
          list is Greek tech employers checked on the date shown; add any employer that uses
          Workable, Greenhouse or Lever.
        </p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {curated.map((e) => (
            <li key={`${e.source}:${e.name}`} className="flex justify-between gap-2 text-muted-foreground">
              <span className="text-foreground">{e.name}</span>
              <span className="text-xs">
                {e.greekJobs} in Greece · {e.checkedOn}
              </span>
            </li>
          ))}
          {own.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <span>
                {e.name} <span className="text-xs text-muted-foreground">({e.source.toLowerCase()} · {e.query})</span>
              </span>
              <form action={unwatchEmployer.bind(null, e.id)}>
                <Button type="submit" size="sm" variant="ghost" aria-label={`Stop watching ${e.name}`}>
                  ×
                </Button>
              </form>
            </li>
          ))}
        </ul>
        <form action={action} className="flex flex-wrap items-end gap-2 border-t pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="watch-source">Board</Label>
            <select id="watch-source" name="source" className={selectClass} defaultValue="WORKABLE">
              <option value="WORKABLE">Workable</option>
              <option value="GREENHOUSE">Greenhouse</option>
              <option value="LEVER">Lever</option>
            </select>
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="watch-slug">Employer slug</Label>
            <Input id="watch-slug" name="slug" placeholder="e.g. skroutz — from apply.workable.com/skroutz" />
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Checking…" : "Watch"}
          </Button>
          {state.error && (
            <p role="alert" className="w-full text-xs text-destructive">
              {state.error}
            </p>
          )}
          {state.message && (
            <p role="status" className="w-full text-xs text-muted-foreground">
              {state.message}
            </p>
          )}
        </form>
      </div>
    </details>
  );
}
