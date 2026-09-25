import { expect, test } from "@playwright/test";

/**
 * The one page a visitor sees without an account (T11). Checks that it is
 * public, that its screenshots load (a guarded image answers a redirect and
 * renders as a broken image — that is how the middleware matcher was found),
 * and that "Try the demo" lands inside the app with the demo's data.
 */
test("the landing page is public, shows its screenshots, and the demo button signs in", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length);
  expect(broken, "screenshots on the landing page").toBe(0);

  await page.getByRole("button", { name: /try the demo/i }).first().click();
  await page.waitForURL(/\/today/);
  // The demo account is seeded with a CV in both languages, so the builder
  // shows a finished document rather than an empty form.
  await page.goto("/cv/builder?lang=el");
  await expect(page.locator('div[lang="el"]').getByText("Demo User")).toBeVisible();

  // A signed-in visitor never sees the landing page.
  await page.goto("/");
  await page.waitForURL(/\/today/);
  expect(errors).toEqual([]);
});
