# CLAUDE.md — Job Hunt Copilot

Project rules for Claude Code. Read `SPEC.md` for the full product spec and data model.

## What this app is

A job application tracker with an LLM layer: the user pastes a job description, the app
compares it against their stored CV and returns a structured analysis (match score, matched
skills with evidence, gaps, ATS keywords, likely interview questions), then generates cover
letters and follow-up emails grounded in that analysis.

Single developer, portfolio project. Ship small, ship deployed.

## Stack

- Next.js 15 (App Router) + TypeScript `strict`
- Tailwind CSS + shadcn/ui
- Prisma + PostgreSQL (Neon)
- Auth.js (NextAuth v5): credentials + GitHub OAuth
- Zod for every boundary: forms, env vars, LLM outputs
- Vitest (unit) + Playwright (one happy path)
- Deployed on Vercel, CI on GitHub Actions
- pnpm

## Non-negotiable rules

1. **Ownership check on every data access.** Every Prisma query touching user data filters by
   `userId` taken from the session. `requireOwnedApplication(id)` is the only way to reach an
   application. `Analysis`, `Document`, and `Event` carry their own `userId` (denormalized from
   the parent `Application`, set in the same write) — queries against them filter by **both**
   `userId` and `applicationId`. Direct `db.analysis.*` / `db.document.*` / `db.event.*` calls
   are allowed only inside `lib/applications/`; an ESLint rule (`no-restricted-imports` /
   `no-restricted-syntax`) fails CI if they appear anywhere else — added when those models land
   (M2/M4), not before. Never a bare `findUnique({ where: { id } })` on user-owned rows.
2. **Zod at every boundary.** Env vars validated at boot in `lib/env.ts`. Form input validated
   in server actions. LLM output parsed with `safeParse`, never trusted.
3. **Server Components by default.** `"use client"` only for interactivity, and as low in the
   tree as possible. Mutations go through server actions. An API route exists only where a text
   stream *is* the product — `app/api/generate/route.ts`, for cover letters and follow-ups.
   Analysis is not streamed (a partial JSON object can't be validated mid-stream): it's a server
   action with a pending state.
4. **No scraping.** The user pastes job descriptions. Never fetch a job board URL server-side.
5. **No secrets in client code.** All LLM calls happen server-side. `NEXT_PUBLIC_*` is for
   non-secrets only.
6. **Migrations, not `db push`.** Every schema change is a named migration committed to git.
7. **Errors are handled, not swallowed.** No empty catch blocks. LLM failures surface a clear
   message and never write partial rows.
8. **Derived fields have exactly one writer.** `Application.latestMatchScore` and
   `Application.lastAnalyzedAt` are written only by the analyze action, in the same transaction
   as the `Analysis` insert — never set them anywhere else. Same rule for any future denormalized
   field.
9. **Confirm the target database before destructive Prisma commands.** Never run
   `prisma migrate reset` or `prisma db push --force-reset` without first echoing the target
   database name. This Neon project hosts more than one app's data — see NOTES.md.

## Code conventions

- Files: `kebab-case.ts`. React components: `PascalCase` named exports.
- Domain logic lives in `lib/`, not in page components. Pages compose, they don't compute.
- Types are inferred from Zod schemas (`z.infer`), not hand-written twice.
- Dates: store UTC, render in the user's locale. Never construct dates from strings by hand.
- No `any`. No `@ts-ignore`. If a type is hard, model it properly or ask.
- Tailwind: no arbitrary values unless there's no scale token that fits.

## Structure

```
app/
  (auth)/login  (auth)/register
  (app)/today  (app)/applications  (app)/applications/[id]  (app)/insights  (app)/profile
  api/generate/route.ts       # streaming endpoint — cover letters & follow-ups only
lib/
  auth.ts  db.ts  env.ts
  applications/               # queries + server actions + ownership helpers (incl. the analyze action)
  llm/
    index.ts types.ts repair.ts usage.ts
    providers/{gemini,groq,ollama,anthropic}.ts
    prompts/{analyze.v1.ts,cover-letter.v1.ts,follow-up.v1.ts}
  schemas/                    # Zod schemas shared by prompts, forms and types
components/
prisma/schema.prisma  prisma/seed.ts
evals/fixtures/*.json  evals/run.ts
```

## LLM layer rules

- One interface, several providers: `LlmProvider.complete({ system, user, schema, maxTokens })`
  returns `{ text, usage, latencyMs }`. Each provider translates the Zod-derived JSON schema into
  its own structured-output mechanism (Gemini `responseSchema`, Groq/OpenAI `json_schema` mode,
  Anthropic tool-use, Ollama `format: json` + schema in the prompt) — the shared layer only
  generates the schema, parses, and repairs. Provider chosen by `LLM_PROVIDER` env var. A
  conformance test suite (M4) runs the same fixture through every registered provider; adding a
  provider means passing that suite, nothing else.
- The Zod schema is the single source of truth: the JSON schema in the prompt is generated
  from it with `zod-to-json-schema`.
- Grounding is concrete: normalize both sides (lowercase, collapse whitespace, strip smart
  quotes/trailing punctuation), then substring-match `evidenceFromCv` against the normalized
  `cvText`. Minimum 15 characters after normalization — a bare skill name is not evidence.
  Entries that fail are dropped silently, no repair; the count is stored as
  `Analysis.droppedClaims` and shown in the UI. If every matched skill is dropped, don't save a
  normal-looking result — surface it as low-confidence.
- On a `safeParse` failure: exactly one repair attempt that includes the validation error in
  the prompt. On a second failure, throw a user-facing error and save nothing. A grounding drop
  is a content decision, not a parse failure, and never triggers a repair attempt.
- Every prompt file exports a `version` string, stored on the `Analysis` row.
- Enforce `DAILY_LLM_CALL_LIMIT` per user through `UsageCounter` before calling the provider.
- Temperature: 0.2 for analysis, 0.7 for generated letters.

## Workflow

- Work milestone by milestone (see SPEC.md §5). Do not start the next milestone's work.
- Anything outside the current milestone goes to `NOTES.md` as a follow-up, not into the diff.
- Run `pnpm typecheck && pnpm lint && pnpm test` before saying a milestone is done.
- Small commits, conventional style: `feat(applications): add status filter`.
- After each milestone: push, confirm the Vercel deploy is green, note anything surprising in
  the README's "what was hard" section while it's fresh.

## When unsure

Ask before: adding a dependency, changing the data model, introducing a new abstraction layer,
or picking up work outside the current milestone. Prefer the boring, explicit solution.
