import { z } from "zod";

// Only DATABASE_URL/DIRECT_URL are required in M0. Auth and LLM vars stay
// optional until the milestone that reads them (M1, M4) tightens them, so an
// M0 deploy can boot without GitHub/LLM credentials.
export const envSchema = z.object({
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),

  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),

  LLM_PROVIDER: z.enum(["gemini", "groq", "ollama", "anthropic"]).default("gemini"),
  LLM_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
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
