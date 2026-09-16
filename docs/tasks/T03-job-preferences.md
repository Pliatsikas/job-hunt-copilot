# T03 — Job preferences, pre-filled from the CV

**Status:** in progress · **Branch:** `task/03-job-preferences`

## Asked (owner, 2026-09-16)

Leads should find jobs automatically, in the owner's field, from what the CV says, plus
fields the owner sets (where they are, etc.). The current Leads page exposes the mechanism
(source, slug, query) and the owner cannot tell what it does. This is step one of three:
T03 preferences → T04 "Jobs for you" over Jooble/Remotive with local ranking → T05 daily cron.

## Decisions

- **A typed table, not the unused `Profile.preferences` Json column.** The cron in T05 has
  to select users with `autoSearch = true`; a Json column would make that a full scan with
  a JSON path. `JobPreferences` is 1:1 with User.
- **The model proposes, the owner disposes.** One structured LLM call reads the CV and
  suggests target roles, seniority, city and country. Nothing is saved until the owner
  clicks save on a form they can edit. Counts against the budget like any call. The
  suggestion never overwrites what the owner already typed — it fills empty fields only.
- **Target roles are chips**, same editor as skills, lowercased and de-duplicated, max 8.
  They become search keywords in T04; a long paragraph would not.
- **Remote preference is an enum** (`REMOTE_ONLY`, `REMOTE_OK`, `ONSITE_OK`, `ANY`) because
  T04 turns it into which sources to query — Remotive only makes sense for the first two.
- **Languages** default to `["el", "en"]` for a Greek owner; T04 filters postings by the
  language the analysis already detects.
- **Sits on the profile page**, under the CV, as "What I'm looking for". Leads gets a
  one-line summary with an edit link in T04.

## Built

- `JobPreferences` model + migration `job_preferences`
- `lib/schemas/job-preferences.ts` — form schema (roles lowercased/deduped, max 8) and the
  narrower suggestion schema (roles, seniority, city, country, rationale — nothing the CV
  cannot say)
- `lib/llm/prompts/suggest-preferences.v1.ts` — grounded: every title must be supported by
  the CV; one adjacent title allowed; "do not guess" on location
- `lib/profile/preferences.ts` — `getJobPreferences`, `saveJobPreferences`,
  `suggestJobPreferences` (budgeted; returns a proposal, writes nothing)
- `components/chips-editor.tsx` — controlled chips, so the suggestion can fill them
- `app/(app)/profile/preferences-form.tsx` — "What I'm looking for" under the CV; the
  suggestion fills only empty fields
- Mock provider answers the suggestion schema; E2E suggests, edits remote, saves, checks
  the row and the budget count (now 5 calls)
- Run on the owner's real CV: Fullstack / Frontend / Backend / AI Engineer / ML Engineer,
  JUNIOR, Thessaloniki, Greece — 2,142 tokens, no repair

## Verify

Preview URL: https://job-hunt-copilot-gr52ddnav-pliatsikas-projects.vercel.app · PR: https://github.com/Pliatsikas/job-hunt-copilot/pull/3

1. `/profile` → new section "What I'm looking for", empty for a new account.
2. "Suggest from my CV" → roles/seniority/city appear in the form (not saved yet), one
   call counted on `/usage`.
3. Edit a role chip, pick remote preference, save → persists on reload.
4. Clear the CV → the suggest button explains it needs a CV.

## Left out

- Using the preferences (T04). Nothing reads them yet except the profile page.
