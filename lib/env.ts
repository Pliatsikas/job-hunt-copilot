import { z } from "zod";

// .env.example lists every var as `KEY=` (present, empty) rather than
// omitting unset ones — Next.js loads that as "", not undefined. Treat ""
// the same as absent so .optional() actually behaves as optional here.
const optionalEnvString = () =>
  z.preprocess((val) => (val === "" ? undefined : val), z.string().min(1).optional());

/** Same "" -> unset treatment, for the numeric limits. */
const positiveInt = (fallback: number) =>
  z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : val),
    z.coerce.number().int().positive().default(fallback),
  );

// AUTH_SECRET is required as of M1 — JWT signing needs it regardless of
// provider. The GitHub pair stays optional: Preview URLs are dynamic, so no
// stable OAuth callback can exist there, and requiring them would only force
// dummy values into environments that can never use GitHub sign-in. GitHub is
// registered as a provider only when both are present (SPEC.md §8 Α7).
// LLM vars stay optional until M4 reads them.
export const envSchema = z.object({
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),

  AUTH_SECRET: z.string().min(1),
  AUTH_GITHUB_ID: optionalEnvString(),
  AUTH_GITHUB_SECRET: optionalEnvString(),

  LLM_PROVIDER: z.enum(["gemini", "groq", "ollama", "anthropic"]).default("gemini"),
  LLM_MODEL: z.string().min(1).default("gemini-3.5-flash"),
  GEMINI_API_KEY: optionalEnvString(),
  GROQ_API_KEY: optionalEnvString(),

  // Kill switch, independent of every counter below: it stops spend now,
  // without waiting for a budget to fill or a limit to be redeployed.
  LLM_ENABLED: z
    .preprocess((v) => (v === "" || v === undefined ? true : v === "true" || v === true), z.boolean())
    .default(true),

  // Daily budgets. Defaults are the Groq profile — see lib/limits.ts for how
  // they were measured, and .env.example for the Gemini alternative.
  USER_DAILY_REQUESTS: positiveInt(12),
  USER_DAILY_TOKENS: positiveInt(40_000),
  ADMIN_DAILY_REQUESTS: positiveInt(150),
  ADMIN_DAILY_TOKENS: positiveInt(400_000),
  GLOBAL_DAILY_REQUESTS: positiveInt(900),
  GLOBAL_DAILY_TOKENS: positiveInt(2_250_000),
  GLOBAL_USER_SHARE_REQUESTS: positiveInt(600),
  GLOBAL_USER_SHARE_TOKENS: positiveInt(1_500_000),

  // IP rate limits on the auth endpoints. Registration is priced highest:
  // each new account mints a fresh daily budget, which is the cheapest abuse.
  REGISTER_LIMIT_PER_HOUR: positiveInt(5),
  REGISTER_LIMIT_PER_DAY: positiveInt(10),
  LOGIN_LIMIT_PER_15_MIN: positiveInt(10),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables. Check .env against .env.example:\n${issues}`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();
