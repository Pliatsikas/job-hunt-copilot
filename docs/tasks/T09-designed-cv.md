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
- **The model may write — the rule changed on 2026-09-17, by the owner.** The first build
  kept the "select and reorder only" rule from M11: extraction copied strings verbatim, and
  tailoring returned ids only. The owner tried it and said so plainly: the form filled with
  prose sentences cut out of a paragraph, and the printed CV was "just what I typed" — they
  want the model to *produce the CV for the role* from what they have and what the posting
  wants. So the model now writes, under two guards that are checked in code, not asked for
  in the prompt:
  1. **No new facts** (`lib/cv/facts.ts`). Every fact token in anything the model writes —
     a number, a proper noun, a technology name (`Next.js`, `C#`, `PostgreSQL`, `E-Avenue`,
     `2026`) — must already be in the owner's CV. For a tailored bullet it must be in *that
     entry*: the SaaS project's Node.js does not migrate to the desktop app's bullet.
  2. **Mostly the owner's words** (`supportShare`). A sentence made of ordinary words can
     still be an invention ("Collaborated with senior developers in an agile environment"
     under a role whose only source line names the company). An extracted bullet cites the
     numbered sentence it came from and must share ≥ 50% of its content words with it; a
     tailored rewrite must share ≥ 60% with the original bullet plus the CV; the about
     paragraph ≥ 50% with the CV.
  Anything that fails falls back to the owner's text (tailoring) or is dropped (extraction),
  and is *reported*: the editor lists what was removed and why, the result card and the print
  page list every rewrite as "You wrote → Now says" and every refusal. A CV changed for a
  role is never a surprise at the interview. Measured on the owner's real text against the
  real model: extraction produced proper bullets with nothing padded; tailoring rephrased
  11 bullets, all faithful, and refused one (it wanted "RAG" where the CV says
  "Retrieval-Augmented Generation").
- **"Fill from my CV text"** (`cv-structure@3`) turns the existing `cvText` into the
  structure: groups skills, writes bullets from the numbered sentences, keeps the CV's own
  language. Nothing is saved until the owner presses save.
- **Tailoring** (`tailor-cv@3`) is about wording, not selection — the owner's second note
  (2026-09-18): "I don't care about adding or removing pieces; the point is to change what
  the CV *says* and put in the keywords it finds in the posting." So every entry and every
  bullet is rewritten for the role, and the rewrites may use the posting's vocabulary —
  under one line: an **allowed keyword** is a posting term the analysis matched against the
  CV or listed to mirror, *minus every gap*. "RAG" is allowed when the CV says
  "Retrieval-Augmented Generation"; "Kubernetes" is refused when the analysis says the CV
  lacks it. Allowed keywords may appear in any bullet; CV facts (a company, a number, a stack
  item) still stay with their own entry. Measured on the owner's structured CV: 20 of 21
  bullets rewritten, the summary retargeted with "React and TypeScript frontends",
  "Node.js/PostgreSQL backends", "REST APIs, real-time features, LLM/RAG", "hybrid",
  "Thessaloniki"; one refusal, a URL the model had mistyped. The result is saved on the
  document (`Document.data`: the CV, the changes, the refusals), the plain-text rendering in
  `content` as before.
- **Groq's free tier shaped two settings.** Requests are capped at 8 000 tokens per minute
  *including* `max_tokens`, and gpt-oss spends its allowance reasoning before it writes: at
  default effort the extraction returned an empty answer. Both structured calls now run with
  `reasoning: "low"` and 5 000 output tokens, and the retry helper waits for a per-minute
  413 instead of retrying it in two seconds.
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
  my CV text" (`cv-structure@3`) writes the profile's text into the form as a CV reads —
  every string fact-checked and every bullet traced to its numbered source sentence
  (`lib/cv/facts.ts`, `lib/cv/sentences.ts`, `lib/cv/extract-grounding.ts`); what was
  dropped is listed with the reason. Photo: resized in the browser to 640 px, JPEG,
  ≤ 300 KB, saved as a data URL.
- **Tailoring** `tailor-cv@3`: the model returns ids plus rewrites
  (`lib/schemas/cv-selection.ts`); `lib/cv/select.ts` applies them with the guarantees
  (every role and education entry stays, an entry chosen with no bullets keeps all of them,
  skills keep their order, unknown ids are dropped and counted, a rewrite is used only when
  its facts are the entry's and its words are mostly the owner's). `components/cv/changes.tsx`
  shows "You wrote → Now says" and the refusals on the result card and above the print. The
  line-based `tailor-cv@1` remains the fallback when no structured CV exists in the chosen
  language. The application page offers the CV language from the languages that have one,
  and links straight to the result.
- `LlmRequest.reasoning` ("low" for the two structured calls); `lib/llm/retry.ts` waits out
  Groq's per-minute 413.
- **The document** `app/(print)/cv/[id]/[version]` — a route group with no shell, Source
  Serif 4 (Greek subset) for the name — renders `components/cv/designed-cv.tsx` from
  `Document.data`; older text documents render as before. Print-to-PDF: A4, one page for the
  owner's CV, colours preserved.
- Profile page: a card pointing to the editor, saying which languages are ready.
- Tests: `lib/cv/facts.test.ts`, `lib/cv/sentences.test.ts`, `lib/cv/extract-grounding.test.ts`,
  `lib/cv/select.test.ts`, `lib/llm/retry.test.ts` (382 unit); layout spec covers
  `/profile/cv`; happy path still exercises the text fallback.

Measured with a probe account holding the owner's real CV text (the prose version the test
account has) against a production build and the real model (Groq): extraction in 8 s, proper
bullets, thin roles left thin, one drop ("Self-employed" as an org — not in the text);
tailoring for a fullstack posting kept 85% of the bullets and every role, rephrased 11
bullets — all faithful on inspection — and refused one; the print came out as one A4 page in
the reference layout, with the photo.

## Verify

https://job-hunt-copilot-1eb1k8e4q-pliatsikas-projects.vercel.app — with your own account: Profile → "Open the CV" → EN →
"Fill from my CV text" → review (expand "items … were removed" to see what and why), fix
anything, save. Then ΕΛ: paste the Greek version's text in the profile first (or type the
form). Add the photo. On an analysed application: "Make a CV for this role" → pick the
language → open "N bullets rephrased for this role" to read every change → "Open the CV" →
Print / Save as PDF.

## Left out

- Drag-and-drop ordering in the editor (up/down buttons instead).
- Multiple layouts / colour themes — one design, the owner's. The owner wants, later, a
  **CV builder like the paid sites** (pick a template, fill it in on the site, download):
  the structured CV and the print route are the foundation; templates are a task of their
  own once this one has been lived with.
