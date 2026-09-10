# Evals

Job ads against one real CV, run against a pinned prompt version so that changing
the prompt produces a comparison rather than a vibe.

**Current state:** the harness, the metrics and the shared CV are in place; the set
of ten real ads is not. Only `no-fabricated-bridge` — the M5 regression case — is
committed, so `pnpm eval` today reports on that one fixture and the analysis
metrics have nothing to score. Adding the ads is the remaining work, and the format
below is what they need to be in.

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

## Running

```
pnpm eval                      # current prompt version, provider from LLM_PROVIDER
pnpm eval --provider groq
pnpm eval --provider gemini    # spreads across sibling models; see the quota note
pnpm eval --dry-run            # validate fixtures and print the cost, call nothing
```

Results are written to `evals/results/<promptVersion>-<provider>.json`.
