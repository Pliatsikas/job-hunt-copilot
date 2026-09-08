import { z } from "zod";

// .env.example lists every var as `KEY=` (present, empty) rather than
// omitting unset ones — Next.js loads that as "", not undefined. Treat ""
// the same as absent so .optional() actually behaves as optional here.
const optionalEnvString = () =>
  z.preprocess((val) => (val === "" ? undefined : val), z.string().min(1).optional());

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
  LLM_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  GEMINI_API_KEY: optionalEnvString(),
  GROQ_API_KEY: optionalEnvString(),
  DAILY_LLM_CALL_LIMIT: z.coerce.number().int().positive().default(50),
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
