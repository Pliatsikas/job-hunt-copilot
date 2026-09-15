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
];
const WIDTHS = [360, 390, 768, 1024, 1440];

for (const width of WIDTHS) {
  test(`no horizontal overflow and one h1 at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@example.com");
    await page.getByLabel("Password", { exact: true }).fill("demo12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/today/);

    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const { scrollWidth, clientWidth, h1 } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        h1: document.querySelectorAll("h1").length,
      }));
      expect(scrollWidth, `${route} scrolls sideways at ${width}px`).toBeLessThanOrEqual(clientWidth);
      expect(h1, `${route} has ${h1} h1 elements`).toBe(1);
    }
    expect(errors).toEqual([]);
    await context.close();
  });
}
