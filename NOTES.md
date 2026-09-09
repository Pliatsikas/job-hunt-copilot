# Notes

Follow-ups and out-of-scope items, tracked here instead of the diff (per CLAUDE.md's workflow
rules) so decisions don't only exist in chat history.

## M9 — polish checklist

Deliberately not started before M9. Recorded now so the list doesn't get rebuilt from memory.

**Applies:**

- Unique `<title>` and meta description per page via the Next metadata API. Nothing may ship
  rendering as "Create Next App".
- A favicon, and one OG/social share image for the public pages.
- `app/not-found.tsx` and `app/error.tsx` with real copy — a user who hits either should learn
  what happened and what to do, not read a stack trace.
- Exactly one `h1` per page. Meaningful `alt` text. Visible keyboard focus on every
  interactive element.
- Zero console errors and warnings in production. No source maps shipped to production.
  Report the largest client bundles and justify anything over 150kB rather than shrugging at it.
- No placeholder or lorem text anywhere.
- `robots.txt` that **disallows** the authenticated routes (`/today`, `/applications`,
  `/profile`). This app is not meant to be indexed.

**Explicitly out of scope, with the reasoning:**

- **`sitemap.xml` and canonical tags** — there are three public pages and no duplicate-content
  or discovery problem. A sitemap solves crawl discovery at scale; at this size it is
  ceremony, and canonical tags answer a duplication question this app doesn't have.
- **Breadcrumbs and structured data** — navigation is two levels deep. Breadcrumbs exist to
  rescue users from deep hierarchies; there is no hierarchy here to get lost in.
- **LocalBusiness schema** — it would be factually false. This is a personal job-search tool,
  not a business with a location and opening hours. Publishing schema that asserts otherwise
  is deceptive markup, and search engines treat it as spam. Not a judgement call.
- **`llms.txt`** — the app sits behind authentication. A file telling crawlers how to consume
  content they cannot reach accomplishes nothing.
- **Custom domain** — optional, owner's call, not a completion criterion.

## M9 — eval planning

- **The Gemini free tier caps requests per model per day, not per key.** Measured at 20/day
  for `gemini-3.5-flash`; sibling models (`gemini-3.1-flash-lite`, `gemini-flash-latest`) draw
  on separate buckets, which is how the M5 provider comparison ran at all after 3.5-flash was
  exhausted. Consequence for M9: an eval sweep that fires every fixture at one model in one
  burst will exhaust that model partway through and leave a half-finished table. Spread runs
  across models and providers deliberately, and record which model produced which row —
  otherwise a "before/after prompt version" comparison is silently comparing two models.
  A quota failure is already distinguishable in code (`LlmQuotaError`) rather than looking
  like a transient blip, so the runner can report it rather than retrying into the wall.

## Known failure modes

- **`howToBridge` advice restated as current activity.** The analysis suggests how to close a
  gap; the cover letter then claims the candidate is already doing it. Observed in M5: the
  advice "Build a complete CRUD application using Laravel" came back as
  *"αυτή την περίοδο αναπτύσσω μια πλήρη CRUD εφαρμογή με Laravel"* — "I am currently building
  a full CRUD application with Laravel" — which nothing in the CV supports. It is dangerous
  precisely because it sounds modest: a reader skims it as humility rather than as a claim.

  Mitigated in three layers, none of which is sufficient alone:
  1. `cover-letter.v1` marks the bridge as guidance and names the failure mode explicitly.
  2. `lib/llm/fabrication.ts` (`findFabricatedClaims`) flags a first-person present/perfect
     claim in the same sentence as a skill the CV does not evidence, in English and Greek.
  3. `evals/fixtures/no-fabricated-bridge.json` pins it as an M9 eval case.

  **What the automated check does and does not cover.** It catches the blunt grammatical form
  — "I am building X", "έχω υλοποιήσει X", "I work with X" — scoped to the sentence naming the
  absent skill. It is a lint, not a proof. It cannot catch:
  - a fluent paraphrase that implies experience without a first-person verb
    ("recent Laravel work has shown me…");
  - an overstatement of something genuinely in the CV ("expert in" for a crash course);
  - whether the letter is honest *in aggregate*, which is a judgement about emphasis.

  Those need a human reading one output per prompt version. That read is the point of the
  manualReview list in the fixture; do not treat a green eval run as clearance.

## Open

- **Dates render in a fixed English format, not the viewer's locale.** `lib/format.ts` uses a
  pinned `en-GB` formatter with `timeZone: "UTC"`. A Server Component can't see the viewer's
  locale, and formatting per-viewer needs a client component — doing it half-way would just
  trade a wrong locale for a hydration mismatch. The product's UI language is English
  (SPEC.md), so this is consistent for now. Revisit if the app ever needs real localisation.

## Done

- ~~ESLint rule confining `db.analysis.*` / `db.document.*` / `db.event.*` to
  `lib/applications/`~~ — landed in M2 as a `no-restricted-syntax` selector in
  `eslint.config.mjs`, with the rule switched off for `lib/applications/**` itself. Verified
  by linting a deliberate violation (errors) and `lib/applications/` (clean).
  `no-restricted-imports` turned out to be the wrong lever: `lib/db` is legitimately imported
  everywhere for User/Application access, so the restriction is on the property access.

## Known build warnings (recorded, not investigated)

- Vercel production builds emit Edge-runtime warnings from `jose` (Auth.js's JWT library):
  `A Node.js API is used (CompressionStream at line: 18)` and the same for
  `DecompressionStream`, traced through
  `jose/dist/webapi/lib/deflate.js` → `@auth/core/jwt.js` → `next-auth/index.js`.
  First seen on the deploy at https://job-hunt-copilot-gamma.vercel.app (2026-09-08).
  The build succeeds and every live check passes — `/api/health`, middleware redirects,
  register + credentials login end to end — so this is recorded, not chased. Note these did
  *not* appear in local builds after the M1 middleware split; the middleware bundle stayed at
  ~86kB either way, so this is separate from the pg/bcryptjs Edge problem that split fixed.
  Likely a JWE-compression code path that Auth.js's default signed (JWS) sessions never reach.

## After M2

- **Give this app its own Neon role, so the two projects stop sharing one credential.**
  Today the project has exactly one role, `neondb_owner`, and it owns both databases —
  `job_hunt_copilot` (this app) and `neondb` (TaskFlow). That means any password rotation on
  either side breaks the other; confirmed the hard way during the 2026-09-08 rotation, which
  had to be coordinated across both apps.
  Fix: `neonctl roles create` a dedicated role (e.g. `jhc_owner`), grant it on the
  `job_hunt_copilot` database, move this app's `DATABASE_URL`/`DIRECT_URL` onto it, verify,
  and leave `neondb_owner` to TaskFlow alone. Note the grants have to be broad enough for
  Prisma Migrate (CREATE/ALTER), and must be issued while connected as `neondb_owner`.
  Deferred deliberately: it decouples future rotations but does not itself close an exposed
  credential, so it ranks below actually rotating. Do it after M2, not during.

## Infrastructure

- The Neon project (`taskflow`, id `calm-pine-71198930`) is shared between TaskFlow and this
  project — job-hunt-copilot has its own database (`job_hunt_copilot`) on the same
  project/branch, not its own project. Never run a destructive Prisma command
  (`migrate reset`, `db push --force-reset`) without confirming the target database name first
  — see CLAUDE.md rule 9. If real isolation from TaskFlow is ever needed, use a Neon branch,
  not a separate project — the free tier allows multiple branches, not multiple projects.
- Both databases are owned by the single role `neondb_owner`, and `neonctl roles` has no
  password-reset subcommand — rotations happen in the Neon Console, and they are inherently a
  two-app coordination. See the "After M2" note above for the fix.
