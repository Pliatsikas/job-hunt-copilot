# Notes

Follow-ups and out-of-scope items, tracked here instead of the diff (per CLAUDE.md's workflow
rules) so decisions don't only exist in chat history.

## M2

- ESLint `no-restricted-imports` / `no-restricted-syntax` rule enforcing that direct
  `db.analysis.*` / `db.document.*` / `db.event.*` calls live only inside `lib/applications/`
  (CLAUDE.md rule 1, SPEC.md §8 Α1). Nothing to lint against until `lib/applications/` and the
  `Analysis`/`Document`/`Event` models exist — add it alongside those models, not before.

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

## Infrastructure

- The Neon project (`taskflow`, id `calm-pine-71198930`) is shared between TaskFlow and this
  project — job-hunt-copilot has its own database (`job_hunt_copilot`) on the same
  project/branch, not its own project. Never run a destructive Prisma command
  (`migrate reset`, `db push --force-reset`) without confirming the target database name first
  — see CLAUDE.md rule 9. If real isolation from TaskFlow is ever needed, use a Neon branch,
  not a separate project — the free tier allows multiple branches, not multiple projects.
