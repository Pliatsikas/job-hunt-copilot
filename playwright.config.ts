// The spec talks to the real database to assert what was written, so the test
// process needs the same connection string the server uses. Playwright does
// not read .env on its own.
import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * One happy path, run against a real build with a real database and the LLM
 * replaced by lib/llm/providers/mock.ts. Everything else — auth, ownership
 * checks, the grounding pass, the transaction, the stream — is the real code.
 */
export default defineConfig({
  testDir: "./e2e",
  // The spec logs in once and then depends on that session, so its steps are
  // deliberately ordered and must not be parallelised against each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  // One test walks the whole product: register, sign in, CV, application,
  // analysis, generation, usage. Six page loads against a real database add up,
  // so the budget is per-journey rather than per-interaction.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build, not `next dev`: dev-only overlays and recompilation
    // pauses are the usual source of flake in a suite like this.
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      LLM_PROVIDER: "mock",
      // The mock refuses to construct without this; see providers/mock.ts.
      ALLOW_MOCK_LLM: "true",
      LLM_MODEL: "mock-1",
      LLM_ENABLED: "true",
      // Registration limits are exercised deliberately below, so they must be
      // loose enough not to trip on an ordinary run.
      REGISTER_LIMIT_PER_HOUR: "50",
      REGISTER_LIMIT_PER_DAY: "50",
      LOGIN_LIMIT_PER_15_MIN: "50",
    },
  },
});
