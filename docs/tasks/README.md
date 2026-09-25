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
| T02 | Email verification on sign-up (Brevo) | **done** 2026-09-15 | PR #2 |
| T03 | Job preferences, pre-filled from the CV | **done** 2026-09-16 | PR #3 |
| T04 | "Jobs for you" — search from preferences, watched employers, bookmarklet, local ranking | **done** 2026-09-16 | PR #4 |
| T05 | Daily automatic search (Vercel cron), lead expiry | **done** 2026-09-16 | PR #6 · [T05](T05-daily-search.md) |
| T06 | Simplify: guided flow, one action per step, Greek and English everywhere | **done** 2026-09-16 | PR #5 · [T06](T06-simplify.md) |
| T07 | Account settings: password for GitHub accounts, forgot password, change email, first-GitHub-sign-in nudge | **done** 2026-09-17 · PR #8 | [T07](T07-password-for-oauth-accounts.md) |
| T08 | Feels fast: navigation progress, pressed feedback on every button, motion (no loading.tsx — see file) | **done** 2026-09-17 | PR #7 · [T08](T08-feels-fast.md) |
| T09 | The CV for a role: designed like the real one, Greek or English, photo | **merged** 2026-09-20 as the foundation of T10 (PR #9); the tailoring itself stays parked | [T09](T09-designed-cv.md) |
| T10 | CV builder: own section, guided from zero, four templates, live preview, download | **done** 2026-09-20 | PR #10 · [T10](T10-cv-builder.md) |
| T11 | Public face: landing page, one-click demo, full demo account | **in progress** | [T11](T11-public-face.md) |
