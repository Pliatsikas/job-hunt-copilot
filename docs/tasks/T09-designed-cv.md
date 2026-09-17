# T09 — The CV for a role: designed like the real one, Greek or English, with a photo

**Status:** in progress · **Branch:** `task/09-designed-cv`

## Asked (owner, 2026-09-17)

The tailored CV should look like the owner's actual CV (`~/Desktop/Βιογραφικό/cv_site/…`:
dark sidebar with photo, contact, grouped skills, languages, certifications, interests;
main column with name, subtitle, about, experience, education, projects), be available in
Greek or English per role, and carry a photo if wanted. "A big task — it has to be a
genuinely good CV."

## Decisions

- **Structure, not lines.** A designed CV needs to know what is a role, a date, a bullet, a
  skill group. Plain text cannot say. So the profile gains a **structured CV**, one per
  language (`StructuredCv { userId, language, data }`, validated by
  `lib/schemas/structured-cv.ts`): identity and contact, about, skill groups, languages,
  certifications, interests, experience / education / projects with dated entries and
  bullets. The existing `cvText` stays the source for the analysis; the structured CV is the
  source for the designed document. Two things to maintain, but each is the honest shape
  for its job, and the structured one is filled once.
- **Greek or English is a choice of source, not a translation.** The owner writes the CV in
  each language they want to use (they already have both). Tailoring in Greek selects from
  the Greek CV. No line is ever produced by the model, so nothing is ever translated by it.
  A language whose CV is empty is simply not offered.
- **Filling the form: from the CV text, verbatim.** "Fill from my CV text" asks the model to
  sort the existing `cvText` into the structure. Every string it returns must appear
  character-for-character in the source; anything else is dropped before the form sees it.
  That is extraction under the same grounding rule as the analysis, not rewriting — and the
  form is reviewed and saved by the owner, never auto-saved.
- **Tailoring becomes selection by id.** Every bullet, skill, entry and certification has an
  id. The model returns which ids to keep and in what order (`tailor-cv@2`); it cannot
  return text. Skills are subsetted per group in the original order (NOTES item 3, closed).
  The about paragraph is kept or dropped, never edited. The selection is saved on the
  document (`Document.data`), the plain-text rendering in `content` as before.
- **The layout is the owner's, in CSS.** `app/(app)/applications/[id]/cv/[version]` renders
  the sidebar/main design at A4 with a print stylesheet; PDF is still the browser's
  print-to-PDF, no library. Fonts: **Source Serif 4** for the name and **Inter** for the
  rest — DM Serif / DM Sans (the original) have no Greek glyphs, and the Greek version of
  the real CV was silently falling back. Section labels follow the CV's language.
- **The photo is a data URL on the profile** (`Profile.photo`, ≤ 300 KB). The browser
  resizes it to 640 px on the long side before upload (canvas, no dependency); there is no
  file storage to run and nothing to leak from a bucket. Optional: no photo, no sidebar
  photo block.
- **The old line-based tailoring stays as the fallback** for an account with no structured
  CV — the E2E suite and existing users keep working; the designed path is what the owner
  uses. The application page says which one it will produce.

## Built

- **Data**: `StructuredCv` (one per user per language), `Profile.photo`, `Document.data` —
  migration `20260917120000_structured_cv_and_photo`, applied.
- **Schema**: `lib/schemas/structured-cv.ts` (ids on every selectable leaf; all fields
  required because Groq's strict JSON-schema mode refuses optionals), `lib/cv/ids.ts`.
- **Editor** `/profile/cv?lang=el|en`: identity, contact, skill groups (chips keep their
  spelling), languages, certifications, interests, experience / education / projects with
  bullets and links; up / down / remove on every row; one JSON field on submit. "Fill from
  my CV text" (`cv-structure@1`) sorts the profile's text into the form — every string
  checked against the source (`lib/cv/extract-grounding.ts`), the dropped ones listed.
  Photo: resized in the browser to 640 px, JPEG, ≤ 300 KB, saved as a data URL.
- **Tailoring** `tailor-cv@2`: the model returns ids (`lib/schemas/cv-selection.ts`);
  `lib/cv/select.ts` applies them with the guarantees (every role and education entry stays,
  an entry chosen with no bullets keeps all of them, skills keep their order, unknown ids are
  dropped and counted). The line-based `tailor-cv@1` remains the fallback when no structured
  CV exists in the chosen language. The application page offers the CV language from the
  languages that have one, and links straight to the result.
- **The document** `app/(print)/cv/[id]/[version]` — a route group with no shell, Source
  Serif 4 (Greek subset) for the name — renders `components/cv/designed-cv.tsx` from
  `Document.data`; older text documents render as before. Print-to-PDF: A4, one page for the
  owner's CV, colours preserved.
- Profile page: a card pointing to the editor, saying which languages are ready.
- Tests: `lib/cv/extract-grounding.test.ts`, `lib/cv/select.test.ts` (368 unit); layout spec
  covers `/profile/cv`; happy path still exercises the text fallback.

Measured with a probe account holding the owner's real CV text against a production build
and the real model (Groq): extraction filled 12 entries / 19 bullets with nothing invented
(every string grounded); tailoring for a fullstack posting kept 63% of the bullets, every
role, the matched-skill projects; the print came out as one A4 page in the reference layout,
with the photo.

## Verify

https://job-hunt-copilot-l2k5brkv4-pliatsikas-projects.vercel.app — with your own account: Profile → "Open the CV" → EN → "Fill
from my CV text" → review, fix anything, save. Then ΕΛ: paste the Greek version's text in
the profile first (or type the form). Add the photo. On an analysed application: "Make a CV
for this role" → pick the language → "Open the CV" → Print / Save as PDF.

## Left out

- Drag-and-drop ordering in the editor (up/down buttons instead).
- Multiple layouts / colour themes — one design, the owner's.
