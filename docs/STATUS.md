# Project status

Read this at the start of every session, after CLAUDE.md. It says what the app is, what
exists, and what is in flight — so a new chat starts informed rather than re-deriving it.
Update it whenever a task ships. Keep it short: this is a map, not a log. The log is
`docs/tasks/`.

## What the app is

Job Hunt Copilot: a job-application tracker with an LLM layer. Paste a job ad, get an
evidence-backed match score against your stored CV, the gaps worth preparing for, and cover
letters / follow-ups grounded in that analysis. Solo portfolio project, public repo, live at
https://job-hunt-copilot-gamma.vercel.app (demo: demo@example.com / demo12345).

Full product spec in `SPEC.md` (Greek). Coding rules in `CLAUDE.md`. Deferred work and
known failure modes in `NOTES.md`.

## What exists (M0–M12, all shipped)

| Area | Where | Notes |
|---|---|---|
| Auth | `lib/auth.ts`, `lib/register.ts`, `lib/login.ts`, `lib/email/` | Credentials + optional GitHub. Password rules (`lib/password-rules.ts`). Email verification via Brevo (T02): unverified accounts cannot sign in; links hashed, one use, 24h. IP rate limits in `authorize()` and the register action. |
| Applications pipeline | `lib/applications/`, `app/(app)/applications` | CRUD, status events, notes, filters. |
| Profile / CV | `lib/profile/`, `app/(app)/profile` | CV text is the source of truth for every prompt. PDF import in `lib/cv-import/`. Job preferences (T03): roles, location, remote, seniority — suggested from the CV, saved by the owner. |
| Analysis | `lib/analysis/run.ts`, `lib/llm/` | Groq default, Gemini fallback. Grounding drops unquotable claims. Prompt `analyze@2`. |
| Documents | `app/api/generate/route.ts` (streamed), `lib/applications/tailor.ts` | Cover letters, follow-ups, tailored CV (exact-line grounding, no rewriting). |
| Today / reminders | `lib/applications/today.ts`, `lib/dates.ts` | Athens civil days, DST-safe. |
| Insights | `lib/applications/insights.ts` | SQL aggregation, server-rendered charts. |
| Usage limits | `lib/llm/usage.ts`, `lib/limits.ts` | Per-user + global token/request budgets, `LLM_ENABLED` kill switch. |
| Daily search (T05) | `lib/ingest/daily.ts`, `app/api/cron/daily-search`, `vercel.json` | Vercel cron, 06:00 UTC, bearer `CRON_SECRET`. Runs `runJobSearch` for every `autoSearch` user, then expires NEW leads older than 30 days (60 if scored). Record: function logs + `lastAutoRunAt`. |
| Jobs for you (leads) | `lib/ingest/`, `app/(app)/leads` | Search from the owner's preferences across 13 curated Greek employer boards (Workable/Greenhouse) + any they add, Remotive for remote. Local fit ranking (`fit.ts`), no model call. Bookmarklet captures any job page via `/leads/capture`. Public APIs only, never HTML. |
| Evals | `evals/` | `pnpm eval --runs 3`; results committed under `evals/results/`. |
| UI shell | `components/shell/`, `components/page*.tsx` | Sidebar on desktop, bottom tabs on mobile. Inter with Greek subset. |
| Language (T06) | `lib/i18n/` | Cookie `locale=el\|en`, typed messages `messages/{el,en}.ts`, `getT()` server / `useT()` client. Every string in the UI goes through `t()`; adding copy means adding it to both files or typecheck fails. |
| Feedback layer (T08) | `components/shell/navigation-progress.tsx`, `components/ui/button.tsx` | Progress bar + dimmed page on navigation, `pending` prop on every submit button. **No `loading.tsx` anywhere** — it breaks server actions that revalidate (Next bug #66426); `lib/no-loading-boundary.test.ts` enforces it. |
| Guide (T06) | `lib/start/`, `app/(app)/start/[step]` | Three steps for a new account: CV → preferences → first posting analysed. Today shows the guide until done, then an action list. |

## Tests

`pnpm typecheck && pnpm lint && pnpm test` (Vitest, ~356) and `pnpm test:e2e` (Playwright:
happy path + layout at five widths, plus a Greek pass). CI runs the first three on every
push. Note: local E2E talks to the real Neon database and signs in as the demo account —
anything that spends a model call on a plain page visit drains the demo's daily budget.

## In flight

See `docs/tasks/README.md` for the task board. The top entry marked **in progress** is the
current work.

## Owner preferences that shape decisions

- Reports to the owner in Greek; code, comments, commits and README in English.
- The model never rewrites the owner's own text (CV). Select and reorder only.
- One task at a time. Each task gets a file in `docs/tasks/`. Nothing reaches production
  until the owner has verified it on the preview URL.
- **The app is too complex for a new person** (owner + partner, 2026-09-16). Every new screen
  should reduce what there is to learn, not add to it. T06 is the dedicated pass; until then,
  prefer one obvious action over several optional ones.
