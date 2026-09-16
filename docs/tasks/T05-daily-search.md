# T05 — Daily automatic search (Vercel cron), lead expiry

**Status:** done 2026-09-16 · PR #6 · cron registered on production (`0 6 * * *`), first run expected 2026-09-17 06:xx UTC

## Asked (owner, 2026-09-16)

"Jobs for you" should fill itself every day without pressing "Find new postings". The owner
also wants to learn the technology — Vercel cron — so the mechanism is documented here in
enough detail to be read, not just run.

## Decisions

- **One cron, one route.** `vercel.json` declares `/api/cron/daily-search` at 06:00 UTC
  (09:00 Athens). Vercel calls it with `Authorization: Bearer $CRON_SECRET`; the route
  refuses anything else with 401. `CRON_SECRET` is a Vercel environment variable (set on
  production and preview; locally it is optional and the route refuses everything when
  unset, so a dev server can never be driven by accident).
- **Hobby plan means once a day, not to the minute.** Vercel triggers Hobby crons within the
  scheduled hour, not at the exact minute. Good enough for "every morning".
- **Who gets searched:** every user whose `JobPreferences.autoSearch` is true and who has at
  least one target role. Users are run one after another (the boards for one user are
  fetched in parallel already; running users in parallel would multiply the load on the
  same 13 boards for nothing). One user's failure is logged and does not stop the next.
- **Lead expiry:** `NEW` leads older than 30 days become `EXPIRED` — a new `LeadStatus`
  value, so they are neither counted as "to look at" nor confused with something the owner
  dismissed. Nothing is deleted. Leads the owner has scored (a model call was spent) are
  kept a further 30 days.
- **No new table.** The run is logged to Vercel's function logs (one line per user with the
  same numbers the button shows) and `JobPreferences.lastAutoRunAt` records when it last
  ran. The Leads page shows that date and "automatically every morning" while auto-search is
  on. A `CronRun` table can come later if the log ever proves insufficient.
- **Time budget:** `maxDuration = 60` on the route (the Hobby ceiling). Today that is ~3
  users × ~14 boards; if it ever nears the ceiling the fix is to batch users across
  invocations, not to raise the limit.

## Built

- `vercel.json` — the schedule. `app/api/cron/daily-search/route.ts` — the route: checks
  the bearer token (`lib/cron-auth.ts`, constant-time compare, refuses everything when
  `CRON_SECRET` is unset), runs the day, logs one line per user, returns a summary.
- `lib/ingest/daily.ts` — `runDailySearch()` (opted-in users one after another, failures
  recorded per user) and `expireStaleLeads()` (NEW → EXPIRED after 30 days, 60 if a model
  call was spent on it). `LeadStatus.EXPIRED` added by migration
  `20260916210000_lead_expired_status` (additive; applied to Neon).
- `CRON_SECRET` set on Vercel for production and preview.
- Leads page: "Last search {date} · automatically every morning" under the preferences line;
  the profile checkbox note reads "(every morning)".
- Tests: `lib/cron-auth.test.ts`, `lib/ingest/daily.test.ts` (361 total).
- Exercised locally against the production build: 401 without a token, 401 with a wrong
  one, 200 with the right one — two opted-in users, 16 boards each, 3.4 s.

## How Vercel cron works (for the owner)

1. `vercel.json` lists cron jobs: a path on this app and a schedule in cron syntax
   (`0 6 * * *` = minute 0, hour 6, every day, UTC).
2. On deploy, Vercel reads the file and registers the schedule for the **production**
   deployment only — previews never run crons.
3. At the time, Vercel's scheduler makes an HTTP GET to that path on the production URL,
   with the header `Authorization: Bearer <CRON_SECRET>` if the project has that env var.
   That is the only thing that distinguishes Vercel from anyone else on the internet
   calling the URL, which is why the route checks it.
4. The route is an ordinary serverless function: it runs, logs, returns JSON. The log is in
   the Vercel dashboard → project → Logs (filter by `/api/cron`). The cron's own history is
   under Settings → Cron Jobs, with a "Run" button for a manual trigger.
5. Hobby plan: crons run once a day at most, and Vercel does not promise the exact minute —
   only that it fires within the hour.

## Verify

Preview URL: https://job-hunt-copilot-3m53rbqsz-pliatsikas-projects.vercel.app — note the cron itself only runs on production.
On the preview: the Leads page shows "Last search … · automatically every morning". After
the merge: the morning after, Today should show "N new jobs that fit" without pressing
anything, and Vercel → Settings → Cron Jobs lists the job.

## Left out

- Email digest of new leads ("3 new jobs that fit") — the Today page shows them; email is a
  later task once the owner has lived with the daily run.
