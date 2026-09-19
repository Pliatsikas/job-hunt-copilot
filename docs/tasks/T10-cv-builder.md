# T10 — CV builder: pick a template, fill it in, download — like the paid sites

**Status:** in progress · **Branch:** `task/10-cv-builder` (on top of `task/09-designed-cv`)

## Asked (owner, 2026-09-19)

"Let's do the CV builder, full on." The thing the paid sites sell: choose a design, fill in
your details on the site, see it as you type, download the PDF. On top of T09's structured
CV and print route — those are the foundation; T09's *tailoring* stays parked.

## Decisions

- **One builder page, two panes.** `/cv/builder?lang=el|en`: the form on the left (T09's
  editor, unchanged), the CV on the right, rendered live from the form's state as you type.
  On a phone the panes become two tabs (Edit / Preview). The preview is the real template
  component scaled to fit — not a screenshot, not an iframe — so what you see is what
  prints.
- **Four templates, one data shape.** Every template is a server-safe React component
  taking `{ cv, language, photo, design }` and nothing else, so the builder, the standalone
  CV page and the tailored-CV page all render the same way:
  - **Sidebar** — the owner's own design from T09 (dark column with photo, light main).
  - **Classic** — one column, serif headings, rules between sections; the conservative one.
  - **Modern** — two columns on a light page, accent-coloured headings and skill pills.
  - **Minimal** — single column, no colour, no photo: the ATS-safe one that parses cleanly.
- **Design choices are per CV language and saved with it.** `StructuredCv.design` (Json,
  additive migration): `{ template, accent, showPhoto }`. Accent is one of eight named
  colours, not a free hex — a palette that always reads on the page. The tailored-CV route
  reads the same design, so a CV made for a role prints in the template the owner chose.
- **Download is the browser's print-to-PDF, made to feel like a download.** `/cv/mine/[lang]`
  is the owner's own CV in their design; `?print=1` opens the print dialog on load. No PDF
  library, no server rendering, same as T09 — the templates are CSS, and a print stylesheet
  does A4 better than any generated layout.
- **No dependency.** Templates are CSS modules; the preview scale is one `transform`.

## Built

- `lib/schemas/cv-design.ts` — template, accent (eight named colours), showPhoto; defaults;
  `StructuredCv.design` (migration `20260919090000_cv_design`, applied).
- `components/cv/templates/` — `shared.tsx` (props, icons, link rule, `Name` that is an h1
  on its own page and a div when embedded), `sidebar` (T09's design, accent now a custom
  property), `classic`, `modern`, `minimal`; `index.tsx` is the registry.
- `/cv/builder?lang=el|en` — template cards with thumbnails, colour swatches, photo switch
  (comes back on when leaving Minimal), the editor on the left, the real template scaled on
  the right with the A4 page count and a dashed line where the print will break. Design
  changes save themselves; the CV saves from its own button; "Download PDF" opens
  `/cv/mine/[lang]?print=1`, which calls the print dialog once the fonts are in.
- `/cv/mine/[lang]` — the owner's own CV in their design; the tailored-CV route now prints
  in the chosen template too.
- Profile card links to the builder first, the plain editor second.
- E2E: the happy path types into the builder and sees it on the page, switches to Modern /
  Navy, saves, reloads, checks the row, opens `/cv/mine/en`; the layout spec covers
  `/cv/builder`.

Measured on the owner's structured CV against a production build: all four templates
render and print (two A4 pages — this CV has five projects with all their bullets; the
preview says so and shows the break); typing updates the page within a frame; a design
change persists across reload.

## Verify

https://job-hunt-copilot-4clfrwjjq-pliatsikas-projects.vercel.app — Profile → "Open the builder". Pick each template, a colour,
photo on/off; type and watch the page; "Download PDF" → Save as PDF. On the phone: the
Edit / Preview tabs.

## Left out

- Drag-and-drop section ordering (up/down buttons stay).
- Custom fonts per template (each template has its own pair; the pairs have Greek glyphs).
- Cover-letter templates — the letters are generated text; a designed letter is its own task.
