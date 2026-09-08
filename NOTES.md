# Notes

Follow-ups and out-of-scope items, tracked here instead of the diff (per CLAUDE.md's workflow
rules) so decisions don't only exist in chat history.

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
