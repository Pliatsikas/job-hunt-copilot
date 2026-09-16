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

_(filled in as it lands)_

## Verify

Preview URL: _(filled in when pushed)_

## Left out

- Greek/English for the *generated* documents is already a per-document choice and stays.
- The print layout of the tailored CV (owner's earlier note) is its own task.
