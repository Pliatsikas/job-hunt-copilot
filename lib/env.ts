import { z } from "zod";

// .env.example lists every var as `KEY=` (present, empty) rather than
// omitting unset ones — Next.js loads that as "", not undefined. Treat ""
// the same as absent so .optional() actually behaves as optional here.
const optionalEnvString = () =>
  z.preprocess((val) => (val === "" ? undefined : val), z.string().min(1).optional());

// Only DATABASE_URL/DIRECT_URL are required in M0. Auth and LLM vars stay
// optional until the milestone that reads them (M1, M4) tightens them, so an
// M0 deploy can boot without GitHub/LLM credentials.
export const envSchema = z.object({
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),

  AUTH_SECRET: optionalEnvString(),
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
