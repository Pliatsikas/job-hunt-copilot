import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Dummy but shape-valid, so importing lib/env.ts doesn't throw just from
    // being loaded in the test process. Real validation is exercised against
    // envSchema directly in lib/env.test.ts, not via these ambient values.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      DIRECT_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
