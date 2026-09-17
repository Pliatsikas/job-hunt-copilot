import { expect, test } from "@playwright/test";

/**
 * The class of bug only a picture finds, turned into a test: every route at
 * five widths, failing on sideways scroll or a missing/duplicate h1. This
 * would have caught the nav overflowing 390px on every page, and the serif
 * fallback would at least have been visible in the failure screenshot.
 */
const ROUTES = [
  "/today",
  "/applications",
  "/applications/seed-app-fullstack",
  "/applications/new",
  "/leads",
  "/insights",
  "/usage",
  "/profile",
  "/profile/import",
  "/start/1",
  "/start/3",
  "/settings",
  "/profile/cv",
];
const WIDTHS = [360, 390, 768, 1024, 1440];
// Greek copy runs longer than English; the narrowest and widest layouts get
// a second pass in Greek so a label that fits in English is not assumed to
// fit in the other language.
const PASSES: { width: number; locale: "en" | "el" }[] = [
  ...WIDTHS.map((width) => ({ width, locale: "en" as const })),
  { width: 360, locale: "el" },
  { width: 1440, locale: "el" },
];

for (const { width, locale } of PASSES) {
  test(`no horizontal overflow and one h1 at ${width}px (${locale})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    await context.addCookies([{ name: "locale", value: locale, url: "http://127.0.0.1:3100" }]);
    const page = await context.newPage();
    const errors: string[] = [];
    // Tagged with the route, so a failure says where, not just that.
    page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} — ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`${page.url()} — ${e.message}`));

    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@example.com");
    await page.getByLabel(locale === "el" ? "Κωδικός" : "Password", { exact: true }).fill("demo12345");
    await page.getByRole("button", { name: locale === "el" ? /σύνδεση/i : /sign in/i }).click();
    await page.waitForURL(/\/today/);

    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const { scrollWidth, clientWidth, h1 } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        h1: document.querySelectorAll("h1").length,
      }));
      expect(scrollWidth, `${route} scrolls sideways at ${width}px (${locale})`).toBeLessThanOrEqual(clientWidth);
      expect(h1, `${route} has ${h1} h1 elements`).toBe(1);
    }
    expect(errors).toEqual([]);
    await context.close();
  });
}
