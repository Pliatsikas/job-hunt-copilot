import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "loading.tsx" || name === "loading.ts" || name === "loading.jsx") out.push(p);
  }
  return out;
}

/**
 * Guard for a Next.js bug (vercel/next.js#66426, still open on 15.5): a
 * loading.tsx above a page makes every server action that calls
 * revalidatePath for that page hang in its pending state — the button says
 * "Saving…" forever, the change is saved but never shown. T08 measured it at
 * 100% for status changes and ~50% for analyses, and 0% with no loading
 * boundary. Navigation feedback lives in components/shell/navigation-progress
 * instead. If this test ever needs to go, re-run the probe in
 * docs/tasks/T08-feels-fast.md first.
 */
describe("route loading boundaries", () => {
  it("has no loading.tsx anywhere under app/", () => {
    expect(walk(join(process.cwd(), "app"))).toEqual([]);
  });
});
