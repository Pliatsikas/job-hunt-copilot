# T11 — The public face: a landing page, a one-click demo, a full demo account

**Status:** in progress · **Branch:** `task/11-public-demo`

## Asked (owner, 2026-09-22)

Anyone who opens the link lands on a login form. A recruiter (or the owner's own family)
sees nothing of what the app does, and the demo account's CV builder is empty because the
demo has only the old plain-text CV. The owner also said the task doubles as a way for them
to understand their own app better.

## Decisions

- **`/` becomes a public landing page**, not a redirect. It says what the app does in a few
  sentences, shows the screens, and has two doors: "Try the demo" and "Sign in". A signed-in
  visitor is sent on to `/today`, so nothing changes for the owner.
- **One click into the demo.** `/api/demo` signs the visitor in as `demo@example.com` with
  the seeded password and redirects to `/today` — the credentials are already public in the
  README and the seed, so this is a shortcut for what a visitor can do by hand, not a new
  privilege. `POST` only (a link that logs you in on prefetch would be a surprise), rate
  limited per IP like the login form, and refused when `ALLOW_DEMO_LOGIN` is not "true" —
  so a self-hosted copy without a demo account cannot be walked into.
- **The demo account gets everything the app can show**: a structured CV in both languages
  with a design chosen, a tailored CV document, leads, and the analyses/letters it already
  had. All seeded deterministically — no model calls at deploy (`prisma/seed.ts` already
  holds a stored analysis for the same reason).
- **Screenshots are generated, not hand-taken.** `docs/screenshots/capture.ts` already does
  this for the README; it gains the builder and the CV page, and the landing page uses the
  same files. Light theme, 1280×800, ×2 — as they are.
- **The landing page is not a marketing site.** One screen of copy, three screenshots, the
  stack, and the link to the repo. In both languages, like everything else.

## Built

- `app/page.tsx` — the landing page: tagline, what it does in six cards, three screenshots,
  the stack, the repo link, "Try the demo" and "Create an account". Both languages, the
  language switch in its header. A signed-in visitor is redirected to `/today`.
- `lib/demo.ts` — `signInAsDemo()`, a server action behind `ALLOW_DEMO_LOGIN`; it goes
  through the same `authorize()` as the login form, so the per-IP limit applies.
- `lib/auth.config.ts` — `/` is public. `middleware.ts` — `shots/` is excluded from the
  matcher, or the landing page's own images answer a redirect to `/login` and render broken.
- `prisma/seed-cv.ts` + seed — the demo account now has a structured CV in **both**
  languages with a design chosen, and two leads. Written by hand: a seed that called the
  model would spend budget on every deploy.
- `docs/screenshots/capture.ts` — captures the builder too, and writes the three the landing
  page uses into `public/shots/` as well, so the README and the page never drift apart.
- `e2e/landing.spec.ts` — the page is public (200), no broken image, the demo button lands
  in the app with the demo's Greek CV, and a signed-in visitor is redirected.
- README: the demo section says what the account holds and shows the builder.

Two real defects the new E2E caught: the landing page's screenshots were lazy-loaded and the
`shots/` path was behind auth (both fixed), and the CV builder scrolled sideways at 360px —
its panes are grid items, which default to `min-width: auto` and refuse to shrink below
their content; the editor's sticky save bar bled into the gutters inside the builder's column.

## Verify

https://job-hunt-copilot-6gd5bebmu-pliatsikas-projects.vercel.app — open the site signed out (a private window): the landing page,
"Try the demo" → straight into Today with data, the CV section with a finished CV in both
languages.

## Left out

- A separate marketing domain, analytics, cookie banners.
- Resetting the demo account on a schedule — the seed is idempotent and can be re-run by
  hand; a visitor who edits the demo's CV changes it for the next visitor until then.
