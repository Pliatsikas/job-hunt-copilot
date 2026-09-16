# T08 — Feels fast: loading states, pressed feedback, navigation progress, motion

**Status:** in progress · **Branch:** `task/08-feels-fast`

## Asked (owner, 2026-09-16)

"Pages take a moment to load and sometimes I don't know whether I pressed it." Two things:
the app should show *something* the instant you act, and every button should visibly
react. Plus a bit more motion so the interface feels alive.

## Decisions

- **No `loading.tsx`. This was the plan, and it is the one thing this task must not do.**
  The first build added a skeleton per route. The E2E then failed on the second analysis:
  the button stayed on "Analysing…" while the analysis was already saved. Bisecting in a
  production build (dev never reproduces: it neither prefetches nor streams the same way)
  landed on a known, still-open Next.js bug — [vercel/next.js#66426](https://github.com/vercel/next.js/issues/66426):
  a `loading.tsx` above a page plus a server action that calls `revalidatePath` for that
  page leaves the action's transition pending forever. Measured with a probe script against
  `next start`: status change stuck **9/9** with `loading.tsx`, **0/9** without; analysis
  ~50% stuck with, 0/11 without. `router.refresh()` from the client instead of
  `revalidatePath` was no better (5/8 dropped). Skeletons are out until Next fixes it;
  `lib/no-loading-boundary.test.ts` fails the unit suite if a `loading.tsx` comes back.
- **The "did I press it" signal is the shell's job, not the page's.** Three layers, none of
  them a Suspense boundary: a progress bar along the top that starts on any same-origin
  link click and ends when the route commits; the tapped nav item dims and pulses
  (`useLinkStatus`); the current page fades to 55% while the next one loads
  (`html[data-navigating] main`). ~60 lines in `components/shell/navigation-progress.tsx`,
  no dependency.
- **Every button shows its pressed state.** A CSS press (scale 0.97 + darker, 100 ms) on
  `:active`, and a `pending` prop on the shared `Button` that adds a spinner, `aria-busy`
  and disables the control — so a double click cannot fire an action twice. Every submit
  button in the app uses it.
- **Motion that explains, not decorates.** Page content rises in (200 ms); rows on Today,
  the guide and Jobs for you appear with a 40 ms stagger; score meters fill from zero;
  status messages fade in. All under 300 ms, nothing blocks input, and
  `prefers-reduced-motion` collapses every animation and transition to instant.
- **No new dependency.** `tw-animate-css` was already installed; two keyframes in
  `globals.css` cover the rest.

## Built

- `components/shell/navigation-progress.tsx`, `nav-link.tsx` (pending state),
  `app-shell.tsx` mounts the bar in a Suspense (it reads `useSearchParams`).
- `components/ui/button.tsx`: press feedback + `pending`. 19 call sites switched.
- `components/page.tsx` entrance; stagger on Today / guide / leads; `animate-meter` on the
  analysis and usage meters; `globals.css` keyframes and reduced-motion rule.
- `lib/no-loading-boundary.test.ts` — the guard.
- Probe scripts used for the measurement are not committed (they drive the demo account
  against a local production build and spend its daily calls); the numbers are above.

## Verify

_(preview URL when pushed)_ — click around on a phone: the bar and the dimming on every
tap, the spinner on every submit, and — the real test — change a status, add a note, run
an analysis: the button must come back and the page must show the change without a reload.

## Left out

- Prefetching data on hover — the App Router already prefetches route code on link
  hover/viewport; data is per-request and dynamic, so the skeleton is the honest answer.
