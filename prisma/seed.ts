import "dotenv/config";
import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

// Deliberately public — a recruiter needs these to try the live demo.
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo12345";

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      passwordHash,
    },
  });

  console.log(`Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
