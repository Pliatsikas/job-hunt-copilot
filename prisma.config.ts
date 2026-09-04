import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// CLI-only (migrate/generate/studio). The running app never reads this file —
// it connects via the driver adapter constructed in lib/db.ts. Migrate needs a
// direct (non-pooled) connection for DDL, hence DIRECT_URL here rather than the
// pooled DATABASE_URL the app uses at runtime.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
