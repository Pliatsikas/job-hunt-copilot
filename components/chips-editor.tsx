"use client";

import { useState, type KeyboardEvent } from "react";
import { useT } from "@/lib/i18n/client";
import { Input } from "@/components/ui/input";

function normalize(items: string[]): string[] {
  const out: string[] = [];
  for (const raw of items) {
    for (const piece of raw.split(",")) {
      const v = piece.trim().toLowerCase();
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

/**
 * Controlled chips: the parent owns the list, so something else on the page
 * — a "suggest from my CV" result — can add to it. Emits one hidden input
 * per chip under `name`, so `formData.getAll(name)` reads them natively; the
 * server normalizes again on submit, so nothing here is trusted.
 */
export function ChipsEditor({
  id,
  name,
  value,
  onChange,
  placeholder,
  max,
}: {
  id: string;
  name: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max?: number;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const full = max !== undefined && value.length >= max;

  function commit() {
    if (!draft.trim()) return;
    onChange(normalize([...value, draft]).slice(0, max ?? Infinity));
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((item) => (
        <input key={item} type="hidden" name={name} value={item} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-sm text-muted-foreground">{t("common.noneYet")}</span>}
        {value.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
            {item}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== item))}
              aria-label={t("common.remove", { name: item })}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={full ? `Up to ${max}` : placeholder}
        disabled={full}
      />
    </div>
  );
}
