# Job Hunt Copilot

TODO: one sentence describing the app + a screenshot of the analysis view.

## Live demo

TODO: deployed URL + demo credentials.

## The problem

TODO: the problem, with numbers (applications tracked, tabs replaced, etc).

## Architecture

TODO: one diagram (not a library list).

## What was hard

TODO: the repair loop on JSON outputs, grounding against the CV, evals, the ownership
check on every query.

**Three non-interactive charts did not need a charting library.** `/insights` renders its
bar chart as divs with a width percentage and its trend as a 40-line inline `<svg>`, both on
the server. The page ships **178 B** of route-specific JavaScript and a 109 kB first load,
against 156 kB for the application detail page. Recharts would have bought hover tooltips
and cost a client bundle; instead every value is printed as text next to its bar or point,
which also means the charts read on a phone and in a screenshot. The rule I set for myself
was to justify any client bundle over 150 kB — that is the trigger to revisit this if a
chart ever needs brushing, zoom, or a tooltip carrying data that isn't already on screen.

**The per-user limit was 2.5× the whole project's daily capacity.** Gemini's free tier caps
requests *per model per day* — measured at 20/day for `gemini-3.5-flash` — while the app's
per-user limit was 50 calls. A limit that cannot trip before the provider's wall does not
protect anything, and no amount of tuning it would have helped. The fix was to measure
rather than assume: Groq's `openai/gpt-oss-120b` reports `x-ratelimit-limit-requests: 1000`
with an 86.4-second refill, and 86400/1000 = 86.4 says that bucket is per *day*, not per
minute. Fifty times the capacity, so Groq became the deployed default and the budgets were
sized from the measurement.

The second half of that lesson: the free tier meters requests, but cost is tokens, so the
counters track both and enforce whichever binds first. And the generation path — the one
users hit most — was reporting no usage at all, because Groq only sends token counts on a
stream when you ask for them with `stream_options.include_usage`. A budget that silently
ignored every cover letter would have been decoration.

## Eval results

TODO: table comparing prompt versions (schema-valid %, score deviation, skill recall,
cost/latency per provider).

## Running locally

TODO.
