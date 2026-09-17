"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { FOLLOW_UP_CONTEXTS } from "@/lib/llm/prompts/follow-up.v1";
import { LANGUAGES, LENGTHS, TONES } from "@/lib/llm/prompts/shared";
import { useLocale, useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SELECT_FOCUS } from "@/components/ui/select-focus";
import { DocumentActions } from "./document-actions";

const selectClass =
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm" + SELECT_FOCUS;

/**
 * One document kind per panel, one button. The options are the few that
 * change the text (language, tone, length or situation); the UI language is
 * the default for the document language.
 */
export function GeneratePanel({
  applicationId,
  kind,
}: {
  applicationId: string;
  kind: "COVER_LETTER" | "FOLLOW_UP_EMAIL";
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [language, setLanguage] = useState<string>(locale);
  const [tone, setTone] = useState<string>("direct");
  const [length, setLength] = useState<string>("standard");
  const [context, setContext] = useState<string>("after_applying");

  const [output, setOutput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const isFollowUp = kind === "FOLLOW_UP_EMAIL";

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
          ...(isFollowUp ? { context } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? t("application.generationFailed"));
        return;
      }
      if (!response.body) {
        setError(t("application.noContent"));
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
      setError(t("application.lostConnection"));
    } finally {
      setPending(false);
    }
  }

  const filename = `${isFollowUp ? "follow-up" : "cover-letter"}-${language}.md`;
  const id = (name: string) => `${kind.toLowerCase()}-${name}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("language")}>{t("application.language")}</Label>
          <select id={id("language")} className={selectClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {t(`profile.languageOptions.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("tone")}>{t("application.tone")}</Label>
          <select id={id("tone")} className={selectClass} value={tone} onChange={(e) => setTone(e.target.value)}>
            {TONES.map((value) => (
              <option key={value} value={value}>
                {t(`application.tones.${value}`)}
              </option>
            ))}
          </select>
        </div>
        {isFollowUp ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id("context")}>{t("application.situation")}</Label>
            <select id={id("context")} className={selectClass} value={context} onChange={(e) => setContext(e.target.value)}>
              {FOLLOW_UP_CONTEXTS.map((value) => (
                <option key={value} value={value}>
                  {t(`application.contexts.${value}`)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id("length")}>{t("application.length")}</Label>
            <select id={id("length")} className={selectClass} value={length} onChange={(e) => setLength(e.target.value)}>
              {LENGTHS.map((value) => (
                <option key={value} value={value}>
                  {t(`application.lengths.${value}`)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <Button type="button" onClick={generate} pending={pending}>
          {!pending && <PenLine className="size-4" aria-hidden />}
          {pending ? t("application.generating") : isFollowUp ? t("application.followUpTitle") : t("application.writeLetter")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {(output || pending) && (
        <div className="flex flex-col gap-2">
          <div ref={outputRef} className="max-h-96 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
            {output || <span className="text-muted-foreground">{t("application.waitingWords")}</span>}
          </div>
          {output && !pending && <DocumentActions content={output} filename={filename} />}
        </div>
      )}
    </div>
  );
}
