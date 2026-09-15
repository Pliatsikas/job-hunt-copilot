import { expect, test } from "@playwright/test";
import { db } from "../lib/db";

/**
 * The one happy path: register, sign in, store a CV, add an application,
 * analyse it, generate a cover letter. The model is mocked
 * (lib/llm/providers/mock.ts); auth, ownership, grounding, the transaction and
 * the streaming route are all real.
 *
 * The register step exists because M8 could not reach it. The rate limiter was
 * verified against the live database and `headers()` was verified inside the
 * action, but React's server-action wire format defeated curl, so the browser
 * submission itself went uncovered. This closes that.
 */

const RUN = Date.now();
const EMAIL = `e2e-${RUN}@example.com`;
// Meets every rule in lib/password-rules.ts — the register form enforces them.
const PASSWORD = "E2e-password-2026!";

const CV_TEXT = [
  "Fullstack developer with two years of professional experience.",
  "I build React frontends with TypeScript and Next.js for production applications.",
  "I design PostgreSQL schemas and write REST APIs in Node.js with Express.",
].join("\n");

const JOB_DESCRIPTION = [
  "We are hiring a fullstack developer to work across a React and TypeScript frontend",
  "and a Node.js API on PostgreSQL. You will containerise services with Docker and",
  "deploy them to Kubernetes. 3+ years of professional experience required.",
].join(" ");

test.afterAll(async () => {
  // Runs against the real database, so the run cleans up after itself.
  // Cascades take the profile, applications, analyses and documents with it.
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.rateLimit.deleteMany({ where: { key: { contains: "e2e" } } });
  await db.$disconnect();
});

test.describe.configure({ mode: "serial" });

test("register, analyse and generate", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await test.step("register through the real form", async () => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(EMAIL);

    // The checklist flips as the password is typed, and a weak one is refused
    // by the server with the same rule the empty checkbox shows.
    await page.getByLabel("Password", { exact: true }).fill("weakpassword");
    await expect(page.getByText("An uppercase letter")).toBeVisible();
    await page.getByRole("button", { name: /create account|register|sign up/i }).click();
    await expect(page.locator('form p[role="alert"]')).toContainText(/uppercase/i);

    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /create account|register|sign up/i }).click();

    // T02: registration lands on "check your inbox", not on login.
    await page.waitForURL(/\/verify\/sent/);
    await expect(page.getByText(/check your spam folder/i)).toBeVisible();

    const user = await db.user.findUnique({ where: { email: EMAIL } });
    expect(user).not.toBeNull();
    expect(user?.role).toBe("USER");
    expect(user?.passwordHash).toBeTruthy();
    // Unverified until the link is used.
    expect(user?.emailVerified).toBeNull();
  });

  await test.step("a disposable address is refused before anything is sent", async () => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(`e2e-${RUN}@mailinator.com`);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /create account|register|sign up/i }).click();
    await expect(page.locator('form p[role="alert"]')).toContainText(/disposable/i);
    expect(await db.user.count({ where: { email: `e2e-${RUN}@mailinator.com` } })).toBe(0);
  });

  await test.step("sign-in is refused until the email is confirmed", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator('form p[role="alert"]')).toContainText(/confirm your email/i);
    await expect(page.getByRole("link", { name: /resend the link/i })).toBeVisible();
  });

  await test.step("the emailed link confirms the account, once", async () => {
    // With no BREVO_API_KEY the provider logs instead of sending, so the test
    // recovers the token the way a person would not: by re-issuing one through
    // the resend form and reading the hash's owner from the database is not
    // possible (hashed), so it issues a token directly — the same function the
    // action calls — and follows the link it would have emailed.
    const { issueVerificationToken } = await import("../lib/email/verification");
    const token = await issueVerificationToken(EMAIL);

    await page.goto(`/verify?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/email confirmed/i);
    const user = await db.user.findUnique({ where: { email: EMAIL } });
    expect(user?.emailVerified).not.toBeNull();

    // Second use of the same link: no error page, an explanation instead.
    await page.goto(`/verify?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/not valid/i);
  });

  await test.step("a duplicate registration is refused without leaking a stack trace", async () => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /create account|register|sign up/i }).click();

    // Scoped to the form: Next's route announcer is also role="alert", and an
    // unscoped locator matches that empty div instead.
    await expect(page.locator('form p[role="alert"]')).toContainText(/already exists/i);
  });

  await test.step("sign in", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    const alert = page.locator('form p[role="alert"]');
    await Promise.race([
      page.waitForURL(/\/today/).catch(() => {}),
      alert.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {}),
    ]);
    if (await alert.isVisible().catch(() => false)) {
      throw new Error(`sign-in refused: ${await alert.textContent()}`);
    }
    await page.waitForURL(/\/today/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await test.step("store a CV", async () => {
    await page.goto("/profile");
    await page.getByLabel(/cv/i).fill(CV_TEXT);
    await page.getByLabel(/skills/i).fill("react, typescript, postgresql, node.js");
    await page.getByRole("button", { name: /save/i }).click();

    // Wait for the server action to land, not for client state: the textarea
    // holds the typed text whether or not the save happened, and navigating
    // away before the action completes aborts it. This step passed for a while
    // on timing alone, then the UI shell changed the timing and it stopped.
    await expect(page.getByText("Profile saved.")).toBeVisible();
    const profile = await db.profile.findFirst({ where: { user: { email: EMAIL } } });
    expect(profile?.cvText).toContain("Fullstack developer");
  });

  await test.step("import a two-column PDF, review it, replace the CV", async () => {
    // The fixture is a two-column layout printed to PDF — the shape SPEC.md
    // §6.2 names as the real problem — with a fake email and phone number in
    // the sidebar. Both must be gone before the draft reaches the screen,
    // and the draft must not touch the profile until the reviewer says so.
    await page.goto("/profile/import");
    await page.setInputFiles("#pdf", "e2e/fixtures/two-column-cv.pdf");
    await page.getByRole("button", { name: /extract text/i }).click();
    await expect(page.getByText("Review before saving")).toBeVisible({ timeout: 60_000 });

    const draft = await page.locator("#cvText").inputValue();
    expect(draft).not.toMatch(/@/);
    expect(draft).not.toContain("4567");
    expect(draft).toContain("github.com/demo-candidate");
    expect(draft).toContain("RAG-based AI copilot");

    // Not yet saved: the CV from the previous step is still the profile.
    const before = await db.profile.findFirst({ where: { user: { email: EMAIL } } });
    expect(before?.cvText).toContain("Fullstack developer with two years");

    await page.getByRole("button", { name: /replace my cv/i }).click();
    await page.waitForURL(/\/profile\?imported=1/);

    const after = await db.profile.findFirst({ where: { user: { email: EMAIL } } });
    expect(after?.cvText).toContain("RAG-based AI copilot");
    expect(after?.cvText).not.toMatch(/@/);
  });

  let applicationUrl = "";

  await test.step("add an application", async () => {
    await page.goto("/applications/new");
    await page.getByLabel(/role/i).fill("Fullstack Developer");
    await page.getByLabel(/company/i).fill("E2E Labs");
    await page.getByLabel(/job description/i).fill(JOB_DESCRIPTION);
    await page.getByRole("button", { name: /save|create|add/i }).click();

    // Excludes /applications/new explicitly: "new" matches [a-z0-9]+, so a
    // naive pattern resolves instantly against the page we are still on and
    // captures the wrong URL.
    await page.waitForURL(/\/applications\/(?!new$)[a-z0-9]{10,}$/i);
    applicationUrl = page.url();
    expect(applicationUrl).not.toContain("/new");
    await expect(page.getByText("Fullstack Developer").first()).toBeVisible();
  });

  await test.step("analyse it against the CV", async () => {
    await page.getByRole("button", { name: /analyz|analys/i }).click();

    // 62 is the mock's fixed score; seeing it rendered proves the value went
    // through the action, the grounding pass, the transaction and back out.
    await expect(page.getByText("62").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/kubernetes/i).first()).toBeVisible();

    const analysis = await db.analysis.findFirst({
      where: { user: { email: EMAIL } },
      orderBy: { createdAt: "desc" },
    });
    expect(analysis?.matchScore).toBe(62);
    expect(analysis?.promptVersion).toBe("analyze@2");
    // The mock quotes a real line of the CV, so grounding keeps it. A mock
    // whose evidence got dropped would pass this test while proving nothing.
    expect(analysis?.droppedClaims).toBe(0);

    const application = await db.application.findFirst({
      where: { user: { email: EMAIL } },
    });
    expect(application?.latestMatchScore).toBe(62);
    expect(application?.lastAnalyzedAt).not.toBeNull();
  });

  await test.step("generate a cover letter, streamed", async () => {
    await page.goto(applicationUrl);
    await page.getByRole("button", { name: /generate cover letter/i }).click();

    await expect(page.getByText(/Dear Hiring Team/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Kind regards/)).toBeVisible();

    // Persisted only after the stream completes.
    await expect
      .poll(async () => db.document.count({ where: { user: { email: EMAIL } } }), {
        timeout: 15_000,
      })
      .toBe(1);

    const document = await db.document.findFirst({ where: { user: { email: EMAIL } } });
    expect(document?.type).toBe("COVER_LETTER");
    expect(document?.content).toContain("Kind regards");
  });

  await test.step("tailor the CV: every saved line is the CV's own", async () => {
    await page.goto(applicationUrl);
    await page.getByRole("button", { name: /tailor cv to this posting/i }).click();
    await expect(page.getByText(/Saved as Tailored CV v1/)).toBeVisible({ timeout: 30_000 });

    const doc = await db.document.findFirst({
      where: { user: { email: EMAIL }, type: "CV_TAILORED" },
    });
    expect(doc).not.toBeNull();
    // The document's lines minus its headings must all be lines of the CV
    // that was imported earlier — nothing rephrased, nothing added.
    const profile = await db.profile.findFirst({ where: { user: { email: EMAIL } } });
    const cvLines = new Set(profile!.cvText.split("\n").map((l) => l.trim()));
    const savedLines = doc!.content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l !== l.toUpperCase());
    expect(savedLines.length).toBeGreaterThan(3);
    for (const line of savedLines) expect(cvLines.has(line), line).toBe(true);

    await page.goto(`${applicationUrl}/cv/1`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tailored CV v1");
    await expect(page.getByRole("button", { name: /print/i })).toBeVisible();
  });

  await test.step("the budget counted every call, with tokens", async () => {
    await page.goto("/usage");
    // Import, analysis, cover letter, tailored CV: four calls against the budget.
    await page.goto("/usage");
    await expect(page.getByText(/4\s*\/\s*12/)).toBeVisible();

    const counter = await db.usageCounter.findFirst({ where: { user: { email: EMAIL } } });
    expect(counter?.calls).toBe(4);
    // The streaming path reports usage too — M8's "budget would be fiction"
    // fix, asserted rather than assumed.
    expect((counter?.inputTokens ?? 0) + (counter?.outputTokens ?? 0)).toBeGreaterThan(0);
  });

  await test.step("no console errors anywhere in that flow", async () => {
    expect(consoleErrors).toEqual([]);
  });
});
