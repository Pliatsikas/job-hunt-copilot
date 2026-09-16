# T06 — Simplify: guide the person, one action per step, in Greek and English

**Status:** in progress · **Branch:** `task/06-simplify-bilingual`

## Asked (owner, 2026-09-16)

"Πολύ περίπλοκη" — the owner and their partner both found the app hard to work out: too
many separate things to press, in too many places. It should guide you; one button per
screen, the result of one step leading to the next. And the whole UI must be available in
Greek and English, everywhere.

Mockups approved by the owner on 2026-09-16: https://claude.ai/artifact/UcmzDpTXAre1sj7f2Z8mpt

## Decisions

- **Language is a cookie, not a URL.** `locale=el|en`, defaulting from `Accept-Language`
  (Greek browser → Greek). No `/el/…` routes: nothing links to a language, the person
  picks one, and it sticks. The switch lives in the shell (sidebar foot on desktop, top bar
  on mobile) and is a server action that sets the cookie and revalidates.
- **No i18n library.** Messages are typed TypeScript objects (`lib/i18n/messages/el.ts`,
  `en.ts`); `en` is typed against `el`'s shape so a key missing in one language fails
  typecheck, not at runtime. `getT()` on the server, `useT()` on the client through a
  provider seeded from the server. Interpolation is `{name}` replacement. That is ~60 lines;
  `next-intl` would add routing, middleware and a dependency for plural rules this UI does
  not need. If plurals ever matter, both forms go in the messages.
- **The rule for every screen: one primary action, and the result leads to the next.**
  - Today with nothing set up is a three-step guide (CV → what you want → first posting),
    not an empty dashboard. Today with a pipeline is a list of things to do, one button each.
  - The application page has ONE button before analysis; letters, tailored CV and interview
    questions appear after, from the result. The three side cards and the generate panel go.
  - Leads is "Jobs for you" / "Δουλειές για σένα", with "Interested / No".
  - Usage leaves the menu; the budget shows as a line next to whatever spends it.
- **Copy is written twice, once.** Every string added in this task is authored in both
  languages at the same time, in the messages files, so no page ships in one language.
- **Nothing structural changes underneath.** Same actions, same data, same routes (plus
  `/start` for the guide). This is a surface rewrite with the mechanism intact, which is
  what makes it safe to do in one task.

## Built

Three commits on the branch, one per stage:

- **A — the language layer.** `lib/i18n/`: locale cookie (`el|en`, default from
  `Accept-Language`), typed messages (`messages/el.ts` is the shape, `en.ts` must match),
  `getT()` / `useT()`, `setLocale` server action, `LanguageSwitch` in the shell and on the
  auth pages. Usage leaves the nav (five items).
- **B — the flow.** `/start/1..3` (CV as PDF or paste → preferences suggested from the CV
  → first posting, created and analysed on one button). Today is the guide until the three
  steps are done, then a list of things to do with one button per row, plus new leads. The
  application page is one column: a single "Analyse the posting" with the day's call
  count; after it, score, "You have / You are missing", then the letter, the CV and the
  interview questions as next steps. `lib/applications/record-analysis.ts` is the one
  writer for Analysis + Event + derived fields (shared by the analyze action and the
  guide's first-application action). The PDF import and the preferences save take a
  `next` redirect so the guide can route through them.
- **C — the sweep.** Every remaining page and shared component renders through `t()`:
  leads ("Jobs for you" / "Δουλειές για σένα", Interested / No), profile, PDF import,
  usage, insights, auth, error and not-found, the CV print view, status badges, chips.
  The `I18nProvider` sits in the root layout so error boundaries are covered too.

Tests: 356 unit; E2E happy path now walks the guide first (seven counted calls); the
layout spec covers `/start/1` and `/start/3` and runs a Greek pass at 360 and 1440px.

Found on the way: the guide's step 2 asked the model on every visit while roles were
empty, so the layout E2E was spending the demo account's daily calls. It now asks only on
arrival from step 1 (`?suggest=1`, dropped from the URL after firing). The demo counter for
2026-09-16 was reset.

## Verify

Preview URL: https://job-hunt-copilot-cj4ykl344-pliatsikas-projects.vercel.app

What to try, on a phone and a laptop, in both languages (switch at the bottom of the
sidebar / top of the mobile bar):

1. A **new account**: Today shows three steps and one button. Walk them: paste (or upload)
   the CV → Continue; step 2 arrives pre-filled from the CV → Continue; paste a posting →
   "Analyse it" lands on the result.
2. The **application page**: score, what you have / what you lack, then the three next
   steps. Write the letter; make the CV; open the questions.
3. **Today** afterwards: one line per thing to do; "New jobs" appears when a search finds
   something.
4. **Jobs for you**: Interested / No.

Owner's first pass (2026-09-16): likes it; two fixes — the language switch looked broken
(the pill stretched to the sidebar width and the buttons sat short of its border; now a
proper pill with `w-fit` and the forms as `contents`), and each lead needs a way to the
page it was found on (now an "Open the posting" button next to "Interested").

Not verified by me: an intermittent React hydration warning (#418, "HTML") shows up in
roughly one of four local E2E runs, on different pages (the seeded application, `/usage`),
and never reproduced in 30+ scripted loads in dev or production builds. `/usage` has no
page-level client component, so whatever it is lives in the shell or in Next itself. If
the console shows it on the preview, tell me which page.

## Left out

- Greek/English for the *generated* documents is already a per-document choice and stays.
- The print layout of the tailored CV (owner's earlier note) is its own task.
