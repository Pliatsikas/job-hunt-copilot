"use client";

import { useActionState, useState } from "react";
import {
  createSavedSearch,
  deleteSavedSearch,
  runSavedSearch,
  type IngestState,
} from "@/lib/ingest/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass = "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm";

export function SavedSearchForm({
  sources,
}: {
  sources: { value: string; label: string; hint: string }[];
}) {
  const [state, action, pending] = useActionState<IngestState, FormData>(createSavedSearch, {});
  const [source, setSource] = useState(sources[0]?.value ?? "");
  const hint = sources.find((s) => s.value === source)?.hint;

  return (
    <form action={action} className="flex flex-col gap-3 border-t pt-4">
      <p className="text-sm font-medium">Add a search</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="e.g. Vercel board" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="source">Source</Label>
        <select
          id="source"
          name="source"
          className={selectClass}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="query">Query</Label>
        <Input id="query" name="query" required placeholder="vercel" />
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending} variant="secondary">
          {pending ? "Saving…" : "Save search"}
        </Button>
      </div>
    </form>
  );
}

export function SavedSearchRow({
  search,
}: {
  search: {
    id: string;
    name: string;
    source: string;
    query: string;
    lastRunAt: string | null;
    openLeads: number;
  };
}) {
  const [state, run, running] = useActionState<IngestState, FormData>(
    runSavedSearch.bind(null, search.id),
    {},
  );

  return (
    <li className="rounded-lg border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{search.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {search.source} · {search.query}
            {search.lastRunAt
              ? ` · last run ${new Date(search.lastRunAt).toLocaleString("en-GB")}`
              : " · never run"}
            {search.openLeads > 0 && ` · ${search.openLeads} open`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <form action={run}>
            <Button type="submit" size="sm" disabled={running}>
              {running ? "Running…" : "Run"}
            </Button>
          </form>
          <form action={deleteSavedSearch.bind(null, search.id)}>
            <Button type="submit" size="sm" variant="ghost" aria-label={`Delete ${search.name}`}>
              ×
            </Button>
          </form>
        </div>
      </div>
      {running && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Fetching from {search.source}, then scoring the newest few against your CV.
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.message && !running && (
        <p role="status" className="mt-2 text-xs">
          {state.message}
        </p>
      )}
    </li>
  );
}
