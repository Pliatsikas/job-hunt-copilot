import "dotenv/config";
import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

// Deliberately public — a recruiter needs these to try the live demo.
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo12345";

const CV_TEXT = `Fullstack developer, two years of professional experience.
I build React frontends with TypeScript and Next.js for production applications.
I design PostgreSQL schemas and write REST APIs in Node.js with Express.
I use Docker for local development and for the deployment pipeline.
I have shipped and maintained two internal tools used daily by a team of twelve.
I completed a PHP crash course in 2026.`;

/**
 * A stored analysis rather than a generated one. §6.1 asks for a demo account
 * that shows the product's value without spending quota — a visitor who lands
 * on it should see a filled-in application with a real-looking analysis before
 * deciding whether to spend one of their twelve daily calls. Generating this
 * at seed time would spend the project's budget every deploy, and would make
 * the seed non-deterministic on top of that.
 *
 * Every evidenceFromCv quote below is a verbatim substring of CV_TEXT, so it
 * survives the same grounding check a live analysis goes through.
 */
const SEEDED_ANALYSIS = {
  matchScore: 62,
  verdict: "stretch",
  summary:
    "Strong modern JavaScript fullstack skills against a role that also wants container orchestration and a year more experience than the CV shows.",
  matchedSkills: [
    {
      skill: "react",
      evidenceFromCv:
        "I build React frontends with TypeScript and Next.js for production applications.",
    },
    {
      skill: "postgresql",
      evidenceFromCv: "I design PostgreSQL schemas and write REST APIs in Node.js with Express.",
    },
    {
      skill: "docker",
      evidenceFromCv: "I use Docker for local development and for the deployment pipeline.",
    },
  ],
  gaps: [
    {
      skill: "Kubernetes",
      severity: "blocker",
      howToBridge:
        "Deploy one of your existing Docker services to a small managed cluster and write up what changed.",
    },
    {
      skill: "GraphQL",
      severity: "important",
      howToBridge:
        "Add a GraphQL layer over the REST API you already have, so you can speak to the trade-off from experience.",
    },
  ],
  keywordsToMirror: ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker", "CI/CD"],
  redFlags: ["Asks for 3+ years; the CV shows two."],
  likelyQuestions: [
    "Walk me through a schema you designed and what you would change now.",
    "How do you decide what belongs in a container versus the host?",
  ],
};

const COVER_LETTER = `Dear Hiring Team,

I am applying for the Fullstack Developer role. I build React frontends with TypeScript and Next.js, and I design the PostgreSQL schemas and Node.js APIs behind them — so I am comfortable owning a feature from the query plan to the rendered page.

Your posting asks for Kubernetes, which I have not used in production. What I do have is Docker in daily use for both local development and deployment, which is the part of that story I can speak to honestly today.

I would welcome the chance to talk about the two internal tools I shipped and still maintain.

Kind regards,
Demo User`;

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo User", passwordHash },
  });

  await db.profile.upsert({
    where: { userId: user.id },
    update: { cvText: CV_TEXT },
    create: {
      userId: user.id,
      headline: "Fullstack Developer",
      location: "Athens, Greece",
      yearsOfExp: 2,
      cvText: CV_TEXT,
      skills: ["react", "typescript", "next.js", "node.js", "postgresql", "docker", "express"],
    },
  });

  // Fixed ids keep the seed idempotent: re-running it updates these rows
  // rather than growing a second set beside them.
  const company = await db.company.upsert({
    where: { id: "seed-company-northwind" },
    update: {},
    create: { id: "seed-company-northwind", userId: user.id, name: "Northwind Labs" },
  });

  const analysed = await db.application.upsert({
    where: { id: "seed-app-fullstack" },
    update: {},
    create: {
      id: "seed-app-fullstack",
      userId: user.id,
      companyId: company.id,
      roleTitle: "Fullstack Developer",
      source: "linkedin.com",
      status: "APPLIED",
      appliedAt: new Date("2026-08-24T09:00:00Z"),
      jobDescription:
        "We are looking for a fullstack developer to work across a React/TypeScript frontend and a Node.js API on PostgreSQL. You will containerise services with Docker and deploy them to Kubernetes. GraphQL experience welcome. 3+ years of professional experience.",
    },
  });

  await db.application.upsert({
    where: { id: "seed-app-frontend" },
    update: {},
    create: {
      id: "seed-app-frontend",
      userId: user.id,
      companyId: company.id,
      roleTitle: "Frontend Engineer",
      source: "kariera.gr",
      status: "INTERVIEW",
      appliedAt: new Date("2026-08-30T09:00:00Z"),
      jobDescription:
        "Frontend engineer for a design-system team. React, TypeScript, accessibility, and a strong eye for detail. You will own component APIs used by four product teams.",
    },
  });

  await db.application.upsert({
    where: { id: "seed-app-backend" },
    update: {},
    create: {
      id: "seed-app-backend",
      userId: user.id,
      companyId: company.id,
      roleTitle: "Backend Developer",
      source: "referral",
      status: "SAVED",
      jobDescription:
        "Backend developer, Node.js and PostgreSQL, working on billing. Comfort with SQL and an interest in correctness over cleverness.",
    },
  });

  const existingAnalysis = await db.analysis.findFirst({
    where: { applicationId: analysed.id },
  });
  if (!existingAnalysis) {
    // Mirrors what the analyze action writes, including the denormalized
    // fields it owns (CLAUDE.md rule 8) — the seed stands in for that single
    // writer here rather than adding a second one.
    await db.$transaction(async (tx) => {
      await tx.analysis.create({
        data: {
          applicationId: analysed.id,
          userId: user.id,
          provider: "seed",
          model: "seed",
          promptVersion: "analyze@1",
          matchScore: SEEDED_ANALYSIS.matchScore,
          result: SEEDED_ANALYSIS,
          droppedClaims: 0,
          createdAt: new Date("2026-08-24T09:05:00Z"),
        },
      });
      await tx.application.update({
        where: { id: analysed.id },
        data: {
          latestMatchScore: SEEDED_ANALYSIS.matchScore,
          lastAnalyzedAt: new Date("2026-08-24T09:05:00Z"),
        },
      });
    });
  }

  const existingDoc = await db.document.findFirst({ where: { applicationId: analysed.id } });
  if (!existingDoc) {
    await db.document.create({
      data: {
        applicationId: analysed.id,
        userId: user.id,
        type: "COVER_LETTER",
        language: "en",
        content: COVER_LETTER,
        version: 1,
      },
    });
  }

  // The demo account is a shop window, not a used one: a visitor should find
  // its daily allowance intact.
  await db.usageCounter.deleteMany({ where: { userId: user.id } });

  console.log(`Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`);
  console.log("  profile, 3 applications, 1 stored analysis, 1 cover letter, counters cleared");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
