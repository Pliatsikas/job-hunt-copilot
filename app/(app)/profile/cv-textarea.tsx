"use client";

import { useState } from "react";
import { CV_TEXT_MIN_USEFUL } from "@/lib/schemas/profile";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CvTextarea({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const count = value.length;
  const thin = count < CV_TEXT_MIN_USEFUL;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor="cvText">CV text</Label>
        <span
          className={`text-xs tabular-nums ${thin ? "text-destructive" : "text-muted-foreground"}`}
        >
          {count.toLocaleString("en-GB")} characters
        </span>
      </div>

      <Textarea
        id="cvText"
        name="cvText"
        required
        rows={20}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste your CV as plain text."
        className="font-mono text-xs leading-relaxed"
      />

      {thin ? (
        <p role="status" className="text-sm text-destructive">
          Under {CV_TEXT_MIN_USEFUL.toLocaleString("en-GB")} characters. The analysis matches
          claims against this text — with this little to work with it will find almost no
          evidence and the results won&apos;t be worth much. Paste the whole CV.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          This is the source of truth for every generated analysis and cover letter.
        </p>
      )}
    </div>
  );
}
