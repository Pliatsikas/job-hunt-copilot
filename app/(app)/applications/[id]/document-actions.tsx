"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copy and .md download both stay client-side — no round trip needed. */
export function DocumentActions({
  content,
  filename,
}: {
  content: string;
  filename: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside a secure context or without permission —
      // say so rather than leaving the button looking broken.
      setCopied(false);
      alert("Couldn't copy — your browser blocked clipboard access. Select the text instead.");
    }
  }

  function download() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={download}>
        Download .md
      </Button>
    </div>
  );
}
