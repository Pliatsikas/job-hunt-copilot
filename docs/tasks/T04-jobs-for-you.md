# T04 — "Jobs for you": search from preferences, watched employers, one-click capture

**Status:** in progress · **Branch:** `task/04-jobs-for-you`

## Asked (owner, 2026-09-16)

Leads should fill automatically from what the CV and preferences say, and the page should
make sense without knowing what a "source" or a "slug" is. Jooble was tried and dropped:
its keys are per country and the Greek index is nearly empty (owner checked; a US-market key
returned Athens, Georgia).

## Decisions

- **Workable is the Greek market's ATS, and it has a documented per-employer API.** A curated
  list of Greek tech employers on Workable and Greenhouse, each verified live before being
  listed (`lib/ingest/employers.ts`, with the count on the day). Auto-search reads every
  watched employer's board, filters by the owner's preferences, ranks locally. The owner can
  watch more employers by slug; the list is a starting point, not a ceiling.
- **A bookmarklet for everything without an API.** kariera.gr, LinkedIn, a company site: one
  click on the page being read sends its title, URL and text to `/leads/capture` as a
  top-level navigation with the payload in the URL fragment — so the session cookie travels
  (SameSite=Lax allows top-level GET), the payload never hits a server log (fragments are not
  sent), and nothing is fetched from the job board by the server. SPEC.md §6.4 #5.
- **Ranking is local and free.** `fitScore` 0–100 from: a target role in the title (strong),
  profile skills found in the description, location and remote agreement with preferences,
  exclude-keyword hits (disqualifying). Every lead gets one; the LLM scores only the top few
  on demand, as before. This also closes the NOTES item about scoring the newest three
  instead of the likeliest.
- **Remotive stays**, queried with the target roles, only when remote is acceptable.
  Arbeitnow only when the country is Germany. Jooble is not built.
- **Filtering by preferences happens before insert**, so the queue only ever holds things
  that could plausibly fit — a Skroutz posting for a warehouse manager never becomes a lead
  for a developer.
- **Old saved searches** become "employers you watch" (Greenhouse/Lever/Workable by slug);
  the keyword-search kind (Arbeitnow/Remotive) is derived from preferences and no longer
  user-managed.

## Built

- `lib/ingest/sources/workable.ts` — Workable widget API adapter, `details=true`
- `lib/ingest/employers.ts` — 13 Greek tech employers, each verified live on 2026-09-16 with
  its count of Greek postings that day (Kaizen 49, Agile Actors 28, Spotawheel 25, …)
- `lib/ingest/fit.ts` — local ranking, 0–100, explainable (`matchedTerms`). Tuned on the
  first live run, which exposed four defects in one go: "Full Stack" not matching
  "fullstack"; "engineer" alone earning role credit for a QA job; no penalty for a posting
  that names Bangalore; no seniority signal. Each is now a test.
- `lib/ingest/search.ts` — `runJobSearch(userId)`: targets from preferences (all watched
  boards, Remotive when remote is acceptable, Arbeitnow only for Germany), fetch in
  parallel, filter below fit 25 before insert, `createManyAndReturn` with `skipDuplicates`.
  No model call anywhere — safe to run for everyone daily.
- `lib/ingest/actions.ts` — `findJobsNow`, `watchEmployer` (verified by one fetch),
  `unwatchEmployer`, `captureLead` (bookmarklet), `scoreLead`, `dismissLead`
- `lib/ingest/bookmarklet.ts` + `app/(app)/leads/capture/` — payload in the URL fragment,
  top-level navigation, reviewed on our page, saved by a same-origin action
- `app/(app)/leads/page.tsx` — "Jobs for you": preferences summary, Find jobs now, the
  bookmarklet to drag, employers accordion, queue by fit with matched terms
- E2E captures a lead through the landing page and checks its fit and matched terms

Live run on the owner's CV and preferences (fullstack/frontend/backend/ai, Thessaloniki,
remote OK, junior): 926 postings from 16 boards in 2.0s, 22 kept, top result Kaizen Gaming
Backend Engineer, Thessaloniki. Before tuning, the top twelve were Bangalore, Helsinki and
Lemon.io boilerplate.

## Verify

Preview URL: _(filled in when pushed)_

## Left out

- The daily run itself (T05). This task makes "Find jobs now" one click; T05 makes it zero.
- Employer list maintenance: boards change. The count per employer is recorded with the
  date it was checked, so a stale entry is visible rather than silent.
