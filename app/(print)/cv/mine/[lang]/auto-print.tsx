"use client";

import { useEffect } from "react";

/**
 * `?print=1`: open the print dialog once the fonts are in. "Download PDF"
 * on the builder is this — the browser's Save-as-PDF, which is the only
 * PDF this app makes (docs/tasks/T09-designed-cv.md, "no PDF library").
 */
export function AutoPrint() {
  useEffect(() => {
    let cancelled = false;
    const go = () => {
      if (!cancelled) window.print();
    };
    if ("fonts" in document) document.fonts.ready.then(go);
    else setTimeout(go, 300);
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
