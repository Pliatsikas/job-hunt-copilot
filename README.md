# Job Hunt Copilot

Paste a job ad and get an honest read on it: a match score against your own CV, every claimed
match backed by a verbatim quote from that CV, the gaps worth preparing for, and a cover letter
that addresses the biggest gap instead of pretending it isn't there.

![The analysis view: a match score of 62, three matched skills each quoted from the CV, two gaps
with concrete bridging advice, keywords to mirror, red flags about the posting, and likely
interview questions](docs/screenshots/analysis.png)

## Live demo

**<https://job-hunt-copilot-gamma.vercel.app>**

| | |
|---|---|
| Email | `demo@example.com` |
| Password | `demo12345` |

The demo account is seeded with a profile, three applications, a stored analysis and a cover
letter, so you can see the product without spending any of the shared model budget. Registration
is open if you would rather use your own CV — you get 12 model calls a day.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/today.png" alt="The Today page: two applications overdue for a follow-up, one due today, and one gone quiet for eleven days, each with a snooze and a done action"></td>
<td width="50%"><img src="docs/screenshots/insights.png" alt="The Insights page: a sentence naming the most common blocking gap, a bar chart of recurring skill gaps with counts printed beside each bar, and a line chart of average match score by month"></td>
</tr>
<tr>
<td><strong>Today</strong> — what needs chasing, computed from the last activity on each application rather than from its created date.</td>
<td><strong>Insights</strong> — the patterns across every analysis. Below five analyses it says how many more are needed instead of drawing a line through noise.</td>
</tr>
</table>

## The problem

I applied to 12 jobs over six weeks. The applications lived in a spreadsheet, the job ads lived
in browser tabs, and the cover letters lived in a folder of near-identical `.docx` files. Three
things were genuinely hard, and none of them were the writing:

1. **Deciding whether an ad was worth the hour.** Every posting reads like it wants everything.
2. **Knowing what kept coming up.** After twelve applications I could not have told you which
   skill I was missing most often — the information was there, spread across twelve tabs.
3. **Not overselling.** The fastest way to write a cover letter is to let the ad's vocabulary
   pull you into claiming things you haven't done.

This app answers those three. The third one turned out to be the hard part, and most of the
engineering below exists because of it.

## Architecture

```mermaid
flowchart TB
    subgraph browser["Browser"]
        UI["Server Components<br/>+ a few client islands"]
    end

    subgraph server["Next.js 15 · App Router · Node runtime"]
        SA["Server actions<br/>create · analyse · status · reminders"]
        API["/api/generate<br/>the one route where a stream IS the product"]
        GUARD["requireOwnedApplication()<br/>every query filters by userId"]
        BUDGET["Usage budget<br/>requests + tokens, per role, per Athens day"]
    end

    subgraph llm["lib/llm — one interface, several providers"]
        PROV["LlmProvider<br/>complete() · stream()"]
        REPAIR["Zod safeParse<br/>+ exactly one repair"]
        GROUND["Grounding<br/>evidence must be a verbatim CV substring"]
        FAB["Fabrication detector"]
    end

    DB[("PostgreSQL · Neon<br/>Prisma 7 + driver adapter")]
    GROQ["Groq<br/>gpt-oss-120b"]
    GEM["Gemini<br/>3.5-flash"]

    UI --> SA
    UI --> API
    SA --> GUARD
    API --> GUARD
    GUARD --> DB
    SA --> BUDGET
    API --> BUDGET
    BUDGET --> DB
    SA --> REPAIR
    API --> PROV
    REPAIR --> PROV
    REPAIR --> GROUND
    API --> FAB
    GROUND --> DB
    PROV --> GROQ
    PROV --> GEM
```

Three load-bearing decisions, out of eleven recorded in [SPEC.md](SPEC.md) §8:

- **The analysis is not streamed; the letters are.** A partial JSON object cannot be validated
  mid-stream, so analysis is a server action with a pending state. Prose has nothing to
  validate, so it streams — that is the only API route in the app.
- **`Analysis`, `Document` and `Event` carry a denormalized `userId`** and are queried by both
  `userId` and `applicationId`. An ESLint rule fails CI if anything outside `lib/applications/`
  touches those models directly.
- **Derived fields have exactly one writer.** `latestMatchScore` and `lastAnalyzedAt` are
  written only by the analyse action, in the same transaction as the `Analysis` row.

## What was hard

**The rate limiter that guarded the wrong door.** I put IP rate limiting in the sign-in server
action, wrote tests, and watched them pass. Then I tried to drive it with `curl` and realised
Auth.js also accepts a direct `POST` to `/api/auth/callback/credentials` — the path I had been
using all session to log in, and the path a credential-stuffing script would use. The limiter
was guarding the browser form and nothing else. It now lives inside `authorize()`, which is the
one place both routes cross; the test that proves it works signs in with the *correct* password
from a blocked IP and expects a refusal.

**One user's daily allowance was 2.5× the entire project's capacity.** Gemini's free tier caps
requests per *model* per day — I measured 20/day for `gemini-3.5-flash` — while the per-user
limit was set to 50 calls. A limit that cannot trip before the provider's wall does not protect
anything, and no amount of tuning that number would have helped. The fix started with measuring
instead of guessing: Groq's `openai/gpt-oss-120b` returns `x-ratelimit-limit-requests: 1000` with
an 86.4-second refill, and 86400/1000 = 86.4 tells you that bucket is per *day*. Fifty times the
capacity, so Groq became the deployed default and every budget was sized from the measurement.

**Prisma skips `undefined`, so clearing a field silently kept the old value.** An empty form
input arrives as `""`, which my schema turned into `undefined`, which Prisma treats as "don't
touch this column" rather than "set it to null". Clearing your location and saving showed the
old location again on reload — no error, no failed write, just the previous value calmly
persisting. The fix is to map blank optional fields to `null`, not `undefined`, and it had to be
applied to every form in the app once I understood it was a pattern rather than a bug.

**`\b` is ASCII-only, so the Greek fabrication detector never fired.** M5's detector looks for
first-person claims about skills the CV doesn't support, in English and Greek. Every pattern used
`\b` for word boundaries, and `\b` is defined on ASCII word characters — so it never matches
before a Greek letter, and every Greek pattern silently matched nothing. The suite was fully
green, because every case exercising those patterns had been written in English. The rule is now
in [CLAUDE.md](CLAUDE.md): any regex touching Greek uses the `u` flag and `(?<!\p{L})…(?!\p{L})`.
It caught a second instance in M9, where the eval recall metric would have scored "go" as found
in "mon**go**db".

**The model turned "learn Laravel" into "I am currently building in Laravel".** The analysis
produced a gap with the advice *"Build a complete CRUD application using Laravel"*. The cover
letter then contained *«αυτή την περίοδο αναπτύσσω μια πλήρη CRUD εφαρμογή με Laravel»* — "I am
currently developing a full CRUD application with Laravel". Nothing in the CV supports it, and it
is dangerous precisely because it sounds modest: a reader skims it as humility rather than as a
claim. It is now mitigated in three layers — the prompt names the failure mode, a detector flags
first-person present-tense claims about absent skills, and an eval fixture pins it — and none of
the three is sufficient alone, which is written down where the next person will read it.

**178 B of route JavaScript instead of a charting library.** The insights page has three
non-interactive charts. Recharts would have bought hover tooltips; instead the bar chart is a div
with a width percentage and the trend is a 40-line inline `<svg>`, both server-rendered, with
every value printed as text beside its bar or point. `/insights` ships **178 B** of
route-specific JavaScript and a 109 kB first load, against 156 kB for the application detail
page. The charts also read on a phone and in a screenshot, which is where a portfolio project is
usually seen.

**A local day is 23 or 25 hours, and dividing by 86,400,000 fires "due today" a day early.**
Europe/Athens is UTC+2 in winter and UTC+3 in summer. Subtracting two instants and dividing by
the number of milliseconds in a day is wrong twice a year — and wrong in the direction that makes
a reminder fire early, which is the direction users notice. All date logic lives in
[`lib/dates.ts`](lib/dates.ts) and works in civil dates, with 25 tests covering both 2026 DST
transitions, 23:59 versus 00:01 local, and an application created in one offset and read in
another. The same reasoning decided that usage counters roll over at Athens midnight: the message
says "resets at midnight", and it has to be the user's midnight or the sentence is a small lie.

## Eval results

Job ads against one real CV, run against a pinned prompt version so a prompt change produces a
comparison rather than an impression. `pnpm eval` reports schema validity, score deviation from a
human-set band, recall on skills the analysis must find, dropped claims, latency and tokens. See
[evals/README.md](evals/README.md) for the fixture format.

The CV those numbers come from is committed at
[`evals/fixtures/_candidate.json`](evals/fixtures/_candidate.json), so the run is reproducible
rather than something you have to take on trust.

**What is not here yet:** the intended set of ten real job ads. The harness, the metrics and the
CV are in place, but only the regression fixture below is committed, so the analysis metrics
currently have nothing to score. The before/after comparison in the next section comes from
re-running real applications through the database, not from the fixture suite.

### `analyze@1` → `analyze@2`: the gap-granularity fix

v1 produced faithful readings of each ad that were useless in aggregate. Because a gap could be a
whole requirement, no two postings ever produced the same gap, every count on the insights page
was 1, and the chart flattened into a list. v2 requires one named skill per gap and routes
non-skill requirements to `redFlags`.

Both versions run over the same three applications:

| | `analyze@1` | `analyze@2` |
|---|---|---|
| Gap entries | 6 | 16 |
| …that were requirement sentences, not skills | **3 (50%)** | **0** |
| `redFlags` entries | 5 | 6 |
| Gap entries repeating across applications | 0 | — |

What changed, concretely:

| v1 gap | v2 |
|---|---|
| `PixiJS, Webpack, Gulp, WebAudio` | four entries: `PixiJS`, `Webpack`, `Gulp`, `WebAudio` |
| `3-5 Years of Web Development Experience` | moved to `redFlags`: "3–5 years of experience required" |
| `Moodle or other educational platforms (LMS)` | `Moodle` |

Every `analyze@1` row was kept. The prompt version is stored on each `Analysis`, so the two
populations stay distinguishable and the before/after above is reproducible from the database.

One caveat, stated rather than buried: match scores also moved (45→30, 35→55, 75→80). Those
changes are *not* evidence of improvement — a different prompt scores differently, and the
comparison is confounded by design. Prompt versioning exists so that change is deliberate and
visible, not so it can be claimed as progress.

### Regression fixture

| fixture | provider | result | tokens | latency |
|---|---|---|---|---|
| `no-fabricated-bridge` | groq / gpt-oss-120b | clean — 0 fabricated claims | 1,148 | 1.3s |

### `reasoning_effort` on prose

`gpt-oss-120b` reasons before answering. On a cover letter that reasoning was most of the bill:

| | completion tokens | of which reasoning | total | latency |
|---|---|---|---|---|
| default | 972 | 824 | 1,722 | 2.4s |
| `low` | 183 | 36 | **933** | **0.8s** |

Same letter quality, both clean of fabricated claims, 702 versus 725 characters of output. Set to
`low` for `stream()` only — the structured analysis keeps full reasoning, which is the same split
as disabling Gemini's thinking budget for prose in M4.

### Client bundles

Largest first-load JavaScript, and the 150 kB rule I set myself:

| route | first load | note |
|---|---|---|
| `/applications/new`, `/applications/[id]/edit` | 157 kB | over |
| `/applications/[id]` | 156 kB | over |
| `/profile` | 154 kB | over |
| `/today` | 119 kB | |
| `/insights` | 109 kB | three charts, 178 B of route JS |
| `/usage` | 102 kB | framework floor only |

102 kB of that is the shared React 19 and App Router runtime, present on every route and not
reducible without leaving the framework. The four routes over the line are the form-heavy ones:
they add roughly 52–55 kB for controlled inputs, `useActionState` and the Base UI primitives the
selects are built on. That is the honest accounting rather than a pass — the number to beat is
the ~55 kB, and the lever would be replacing the select primitives with native controls.

## Running locally

Requires Node 22 (`.nvmrc` pins 22.22.2) and pnpm.

```bash
pnpm install
cp .env.example .env          # then fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET
pnpm exec prisma migrate dev  # create the schema
pnpm exec tsx prisma/seed.ts  # demo@example.com / demo12345, with example data
pnpm dev
```

`AUTH_SECRET` wants `openssl rand -base64 32`. For the model layer set `GROQ_API_KEY` (the
default provider) or `GEMINI_API_KEY` with `LLM_PROVIDER=gemini`; `.env.example` documents both
profiles and every budget knob. GitHub sign-in is optional — leave `AUTH_GITHUB_ID` and
`AUTH_GITHUB_SECRET` empty and the button hides itself.

```bash
pnpm typecheck && pnpm lint && pnpm test   # the gate
pnpm test:e2e                              # Playwright, LLM mocked, real database
pnpm eval --dry-run                        # validate fixtures and print the cost
pnpm eval --provider groq                  # spend real quota
```

### Stack

Next.js 15 (App Router, TypeScript strict) · React 19 · Prisma 7 + PostgreSQL (Neon) ·
Auth.js v5 · Zod 4 · Tailwind + shadcn/ui · Vitest + Playwright · Vercel + GitHub Actions.

Zod schemas are the single source of truth: form validation, environment validation, the JSON
schema sent to the model, and the TypeScript types all derive from them.
