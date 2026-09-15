# Task board

One file per task, `T<nn>-<slug>.md`, in the order they were started. A task file records
what was asked, what was decided, what was built, how it was verified, and what was left
out — so a lost chat costs nothing.

## Workflow

1. **Start**: create the task file with the request and the plan. Branch from `main`:
   `task/<nn>-<slug>`.
2. **Build** on the branch. Commit small. Push: Vercel builds a preview deployment for the
   branch automatically — the URL is on the PR and in `vercel ls`.
3. **Hand over**: open a PR, put the preview URL and what to check in the task file's
   "Verify" section, and report to the owner in Greek.
4. **Owner verifies** on the preview URL.
5. **Ship**: only after the owner says so — merge to `main` (that is the production
   deploy), confirm Vercel shows Ready, mark the task **done** below and in its file, update
   `docs/STATUS.md` if the map changed.

Nothing goes to `main` before step 4. `main` is production.

Preview deployments are **not** behind Vercel Authentication (project setting
`ssoProtection: null`, changed 2026-09-15 after the owner was bounced to a Vercel login on
the first preview). The app has its own auth; the preview must open for the owner without
a second sign-in. If a preview ever asks for Vercel login again, that setting has been
reset.

## Board

| # | Task | Status | Branch / PR |
|---|---|---|---|
| T01 | Stronger passwords with a live checklist | **done** 2026-09-15 | PR #1 |
| T02 | Email verification on sign-up (Brevo) | in progress | `task/02-email-verification` |
