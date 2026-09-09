"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CONTEXT_LABELS, FOLLOW_UP_CONTEXTS } from "@/lib/llm/prompts/follow-up.v1";
import { LANGUAGES, LENGTHS, TONES } from "@/lib/llm/prompts/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DocumentActions } from "./document-actions";

const selectClass = "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm";

const KIND_LABELS = { COVER_LETTER: "Cover letter", FOLLOW_UP_EMAIL: "Follow-up email" } as const;
const LANGUAGE_LABELS: Record<string, string> = { en: "English", el: "Ελληνικά" };
const TONE_LABELS: Record<string, string> = {
  direct: "Direct",
  warm: "Warm",
  formal: "Formal",
};
const LENGTH_LABELS: Record<string, string> = { short: "Short", standard: "Standard" };

export function GeneratePanel({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<keyof typeof KIND_LABELS>("COVER_LETTER");
  const [language, setLanguage] = useState<string>("en");
  const [tone, setTone] = useState<string>("direct");
  const [length, setLength] = useState<string>("standard");
  const [context, setContext] = useState<string>("after_applying");

  const [output, setOutput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  async function generate() {
    setPending(true);
    setError(null);
    setOutput("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          kind,
          language,
          tone,
          length,
          ...(kind === "FOLLOW_UP_EMAIL" ? { context } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Generation failed.");
        return;
      }
      if (!response.body) {
        setError("The server returned no content.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Painted as it arrives — this is why generation gets a route and
      // analysis doesn't: there is no schema to satisfy mid-stream.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((current) => current + decoder.decode(value, { stream: true }));
        outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
      }

      // The finished document is now a row; refresh so history shows it.
      router.refresh();
    } catch {
      setError("Lost the connection while generating.");
    } finally {
      setPending(false);
    }
  }

  const isFollowUp = kind === "FOLLOW_UP_EMAIL";
  const filename = `${isFollowUp ? "follow-up" : "cover-letter"}-${language}.md`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kind">Document</Label>
          <select
            id="kind"
            className={selectClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as keyof typeof KIND_LABELS)}
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {isFollowUp ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="context">Situation</Label>
            <select
              id="context"
              className={selectClass}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            >
              {FOLLOW_UP_CONTEXTS.map((value) => (
                <option key={value} value={value}>
                  {CONTEXT_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="length">Length</Label>
            <select
              id="length"
              className={selectClass}
              value={length}
              onChange={(e) => setLength(e.target.value)}
            >
              {LENGTHS.map((value) => (
                <option key={value} value={value}>
                  {LENGTH_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="language">Language</Label>
          <select
            id="language"
            className={selectClass}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {LANGUAGE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tone">Tone</Label>
          <select
            id="tone"
            className={selectClass}
            value={tone}
            onChange={(e) => setTone(e.target.value)}
          >
            {TONES.map((value) => (
              <option key={value} value={value}>
                {TONE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Button type="button" onClick={generate} disabled={pending}>
          {pending ? "Generating…" : `Generate ${KIND_LABELS[kind].toLowerCase()}`}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {(output || pending) && (
        <div className="flex flex-col gap-2">
          <div
            ref={outputRef}
            className="max-h-96 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap"
          >
            {output || <span className="text-muted-foreground">Waiting for the first words…</span>}
          </div>
          {output && !pending && <DocumentActions content={output} filename={filename} />}
        </div>
      )}
    </div>
  );
}
