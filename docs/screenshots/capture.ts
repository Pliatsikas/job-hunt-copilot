/**
 * Regenerates the README screenshots against a running production build on
 * port 3100, using the demo account. Stages the data the shots need (overdue
 * and stale applications for Today, five analyses across months for
 * Insights), captures at 1280px, then re-seeds the demo so nothing staged
 * survives. Run with:
 *
 *   pnpm build && pnpm start --port 3100 &   # in one shell
 *   pnpm exec tsx --env-file=.env docs/screenshots/capture.ts
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { db } from "../../lib/db";

const B = "http://127.0.0.1:3100";
const OUT = "docs/screenshots";
// T11: the landing page shows three of the same shots, so they are captured
// once and written to both places rather than kept in sync by hand.
const PUBLIC_OUT = "public/shots";
const ON_LANDING = new Set(["today", "analysis", "builder"]);
const DEMO = "demo@example.com";

const day = (n: number) => new Date(Date.now() - n * 86_400_000);

async function stage() {
  const user = await db.user.findUniqueOrThrow({ where: { email: DEMO } });
  const company = await db.company.findFirstOrThrow({ where: { userId: user.id } });
  const base = { userId: user.id, companyId: company.id, jobDescription: "Staged for the README screenshot.".repeat(4), status: "APPLIED" as const };
  const apps = await Promise.all([
    db.application.create({ data: { ...base, id: "shot-overdue-1", roleTitle: "Platform Engineer", appliedAt: day(14), nextActionAt: day(3) } }),
    db.application.create({ data: { ...base, id: "shot-overdue-2", roleTitle: "Frontend Developer", appliedAt: day(12), nextActionAt: day(1) } }),
    db.application.create({ data: { ...base, id: "shot-due", roleTitle: "Node.js Developer", appliedAt: day(10), nextActionAt: new Date() } }),
    db.application.create({ data: { ...base, id: "shot-stale", roleTitle: "Fullstack Engineer", appliedAt: day(11), status: "SCREENING" } }),
    db.application.create({ data: { ...base, id: "shot-a5", roleTitle: "React Developer", appliedAt: day(40) } }),
  ]);
  const gaps = [["Kubernetes", "blocker"], ["Kubernetes", "blocker"], ["GraphQL", "important"], ["Kubernetes", "blocker"], ["Terraform", "important"]];
  const scores = [38, 44, 52, 61, 66];
  const months = [95, 70, 45, 20, 3];
  for (let i = 0; i < apps.length; i++) {
    await db.analysis.create({
      data: {
        applicationId: apps[i].id, userId: user.id, provider: "seed", model: "seed", promptVersion: "analyze@2",
        matchScore: scores[i], droppedClaims: 0, createdAt: day(months[i]),
        result: { matchScore: scores[i], verdict: "stretch", summary: "Staged.", matchedSkills: [], gaps: [{ skill: gaps[i][0], severity: gaps[i][1], howToBridge: "…" }], keywordsToMirror: [], redFlags: [], likelyQuestions: [] },
      },
    });
    await db.application.update({ where: { id: apps[i].id }, data: { latestMatchScore: scores[i], lastAnalyzedAt: day(months[i]) } });
  }
}

async function unstage() {
  await db.application.deleteMany({ where: { id: { startsWith: "shot-" } } });
}

async function main() {
  await unstage();
  await stage();
  try {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    await p.goto(`${B}/login`);
    await p.getByLabel("Email").fill(DEMO);
    await p.getByLabel("Password", { exact: true }).fill("demo12345");
    await p.getByRole("button", { name: /sign in/i }).click();
    await p.waitForURL(/\/today/);
    mkdirSync(PUBLIC_OUT, { recursive: true });
    const CLIP = { x: 0, y: 0, width: 1280, height: 800 };
    for (const [path, file] of [
      ["today", "today"],
      ["insights", "insights"],
      ["applications/seed-app-fullstack", "analysis"],
      ["usage", "usage"],
      ["cv/builder?lang=en", "builder"],
    ]) {
      await p.goto(`${B}/${path}`);
      await p.waitForLoadState("networkidle");
      // The landing page lays these out side by side, so they are all the
      // same shape: the top 1280×800 of the page, not a full-page strip.
      const cropped = ON_LANDING.has(file);
      await p.screenshot({ path: `${OUT}/${file}.png`, fullPage: !cropped, clip: cropped ? CLIP : undefined });
      if (cropped) copyFileSync(`${OUT}/${file}.png`, `${PUBLIC_OUT}/${file}.png`);
      console.log("captured", file);
    }
    await b.close();
  } finally {
    await unstage();
    console.log("staged data removed");
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
