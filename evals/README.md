# Evals

Job ads against one real CV, run against a pinned prompt version so that changing
the prompt produces a comparison rather than a vibe.

## The ads are synthetic, and deliberately so

The ten analysis fixtures are **written, not collected**. They are not real job
postings.

Two reasons, and the first is not a technical one. Republishing third-party ad copy
in a public repository is not mine to do — the text belongs to the companies that
wrote it, and a portfolio project is a bad place to test that. Second, the real ads
already live in the app's own database, which is where the `analyze@1` → `analyze@2`
before/after in the top-level README actually came from. Those numbers are from real
postings; these fixtures are the reproducible, publishable half of the picture.

What the fixtures are for is a deliberate *spread* — a clear fit, two clear
mismatches in different directions, an adjacent-but-not-aligned case, a padded
corporate posting, and a Greek pair that separates "handles Greek" from "scores
Greek lower". Each file's `notes` field says what that case is there to catch. A
synthetic ad can be written to isolate one variable, which a real one cannot; the
cost is that they are cleaner than reality, so a suite that is green here is not
evidence of a suite that would be green on live postings.

## Adding a fixture

One JSON file per ad in `evals/fixtures/`, named after its `id`. Copy
`_TEMPLATE.analysis.json`. Files starting with `_` are configuration, not cases.

| field | required | what it means |
|---|---|---|
| `id` | yes | kebab-case, unique. Names the row in the results file. |
| `kind` | yes | `"analysis"` for a job ad. (`"cover_letter"` is the M5 regression case.) |
| `notes` | yes | Why this ad is in the set. A future reader needs to know what it tests. |
| `roleTitle` | yes | As written in the ad. |
| `companyName` | no | `null` if you'd rather not name them. |
| `source` | no | Where it came from — `"jobfind.gr"`, `"linkedin.com"`, `"referral"`. |
| `language` | yes | `"en"` or `"el"` — the language the **ad** is written in. |
| `jobDescription` | yes | The whole ad, pasted verbatim. Minimum 120 characters. |
| `expectedScoreRange` | yes | `[min, max]`, inclusive, 0–100. Your judgement of a fair score. |
| `mustFindSkills` | yes | Skills the analysis **must** match, given the CV. Drives recall. |
| `mustFlagGaps` | no | Skills the ad demands that the CV can't answer. Defaults to `[]`. |
| `cvText` / `skills` | no | Override the shared CV. Only the M5 case needs this. |

Skills are lowercased and trimmed on load, so case and stray spaces don't matter.

### On `expectedScoreRange`

A range, not a point, because scoring is a judgement and two reasonable readers
disagree by ten points. Make it as wide as your honest uncertainty and no wider —
`[0, 100]` measures nothing. A good habit is to write the range **before** running
the model, so the model isn't setting its own target.

The runner reports the distance *outside* the band (0 when inside), so a band
that's too generous quietly reports success. That is the failure mode to avoid.

### Picking the ten

Spread them, so the set can fail in different ways:

- two or three that should score well, to catch a model that is uniformly harsh
- two or three clear mismatches, to catch a flatterer
- at least one Greek-language ad — Greek text has already broken this codebase once
- at least one with a years-of-experience demand, which `analyze@2` must route to
  `redFlags` rather than `gaps`
- at least one very long ad, since input length drives both cost and truncation

## The shared CV

`_candidate.json` holds the one CV every analysis fixture is judged against, and it
is **committed**: it is the real CV the published eval numbers were produced
against, so a reader can re-run them and get the same table. That is worth more
than withholding technical prose which is already public on the CV itself and on
the profiles it links to.

It carries no contact details — no phone, no email, no street address. It was
written that way before it ever reached this repository, which is the only reason
committing it is a reasonable thing to do. If you fork this, do not assume the same
of your own CV: read it first.

`_candidate.example.json` is the synthetic template. Copy it to `_candidate.json`
and replace the contents with your own.

## Reading a run back

```
pnpm eval --report evals/results/analyze-2-groq.json
```

Re-renders a saved run without calling anything. Worth having: at temperature 0.2
a second run is a different sample, so "let me look at that again" has to mean the
saved file, not a fresh call. Each row stores the full grounded analysis, so a
result can be audited — "was the score in range?" is answerable from the summary,
but "is the model wrong or is the band wrong?" needs the reasoning.

### Temperature, and the noise floor

Evals run at **temperature 0**; the app runs analysis at 0.2. Different jobs: the app
writes for a person, where slight variation reads as natural, while an eval has to
be repeatable or prompt effects and sampling noise arrive in the same number.

Temperature 0 is not the whole answer. Measured across three runs of each fixture:

| provider | spread |
|---|---|
| Gemini, all 10 fixtures | 0 — identical scores every run |
| Groq `gpt-oss-120b` | up to 13 points (`ai-engineer-rag-python`: 55, 68, 65) |

`gpt-oss-120b` is mixture-of-experts and is not deterministic at temperature 0 the
way Gemini is. So the noise floor is a property of the provider, and on Groq it is
about ±13 — meaning **no band narrower than roughly 26 points is honest there**. Set
bands with that in mind, quote the median over several runs, and put the spread
beside it.

`--runs N` (default 3) reports both. Note that it holds the model fixed for all runs
of one fixture: rotating per call gave each fixture three different siblings, and
the resulting "spread" was model-to-model difference mislabelled as sampling noise.

### On the metrics

`schema-valid` is counted against **answers received**, not fixtures attempted. A
provider that returns 503 has not produced invalid output; it has produced none.
The first Gemini run had four models time out under load, and folding those in
would have reported a 60% schema rate for a run whose every answer parsed.

`mean score deviation` is distance *outside* the band, zero when inside. That means
a band that is too wide reports a clean pass — which is a real failure mode and not
a hypothetical: both deliberate-mismatch fixtures scored 20 against a ceiling of 22.
Look at where a score sits *within* its band, not just whether it is in one.

## Running

```
pnpm eval                      # current prompt version, provider from LLM_PROVIDER
pnpm eval --provider groq
pnpm eval --provider gemini    # spreads across sibling models; see the quota note
pnpm eval --dry-run            # validate fixtures and print the cost, call nothing
pnpm eval --only <fixture-id>  # one case
pnpm eval --report <file>      # re-render a saved run, call nothing
```

A full run is 11 requests, up to 22 if every one needs its single repair: about 1.1%
of Groq's measured 1,000/day. On Gemini the runner rotates through three sibling
models, because the free tier caps requests per *model* per day at a measured 20.

Results are written to `evals/results/<promptVersion>-<provider>.json`.
