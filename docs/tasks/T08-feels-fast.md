# T08 — Feels fast: loading states, pressed feedback, navigation progress, motion

**Status:** in progress · **Branch:** `task/08-feels-fast`

## Asked (owner, 2026-09-16)

"Pages take a moment to load and sometimes I don't know whether I pressed it." Two things:
the app should show *something* the instant you act, and every button should visibly
react. Plus a bit more motion so the interface feels alive.

## Decisions

- **Every route gets a `loading.tsx`.** Next streams the page: the shell appears at once
  and the page area shows a skeleton in the shape of the real page (a header bar, a few
  card outlines) while the server renders. This is what "lazy load" buys us for free with
  the App Router — no client-side data fetching, no extra library. Skeletons match each
  page's layout so nothing jumps when the content lands.
- **A progress bar for navigation.** A thin bar at the top of the viewport that starts on
  any link click and finishes when the new route is committed — the one signal that says
  "yes, you pressed it" between the click and the skeleton. Built on `useLinkStatus` /
  the router's pending state, ~40 lines, no dependency.
- **Every button shows its pressed state.** Two layers: a CSS press (scale 0.98 + darker
  fill on `:active`, 80 ms) that answers the finger instantly, and — for buttons that
  submit — the existing pending label plus a spinner icon. Links styled as buttons get the
  same press. This lives in `components/ui/button.tsx`, so it applies everywhere at once.
- **Motion that explains, not decorates.** Page content fades/rises in (150 ms) when it
  arrives; list rows on Today and Leads appear with a small stagger; the score meter
  fills from zero; success messages fade in. Everything respects `prefers-reduced-motion`
  (animations off, instant states). Nothing longer than 200 ms, nothing that blocks input.
- **No new dependency.** Tailwind's `animate-*` utilities plus a few keyframes in
  `globals.css`. Framer Motion would be the tool for choreography; this is not that.
- **Measure, don't guess.** Before and after: the E2E records time-to-first-paint of the
  skeleton on the application page; the README notes the numbers.

## Built

_(filled in as it lands)_

## Verify

_(preview URL when pushed)_

## Left out

- Prefetching data on hover — the App Router already prefetches route code on link
  hover/viewport; data is per-request and dynamic, so the skeleton is the honest answer.
