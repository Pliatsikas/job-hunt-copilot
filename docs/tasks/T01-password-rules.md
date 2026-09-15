# T01 — Stronger passwords with a live checklist

**Status:** in progress · **Branch:** `task/01-password-rules`

## Asked (owner, 2026-09-15)

Sign-up should demand a stronger password, with visible checkboxes as the user types:
an uppercase letter, a number, and so on.

## Decisions

- **The rules are one list, used twice.** `lib/password-rules.ts` defines each rule as
  `{ id, label, test }`. The Zod register schema runs the same list on the server; the
  form runs it on the client for the checklist. One source, so the checklist cannot drift
  from what the server actually enforces.
- **Rules:** at least 10 characters; one uppercase; one lowercase; one digit; one symbol;
  not one of the most common passwords. Ten rather than eight: length is the rule that
  matters most, and it costs the user nothing they will remember.
- **Unicode-aware.** "Uppercase" is `\p{Lu}`, not `[A-Z]` — a Greek capital counts. Same
  lesson as the `\b` bug in M5, applied before it bites.
- **No strength meter.** A meter implies a score nobody can explain; a checklist says
  exactly what is missing.
- **Login is untouched.** Existing accounts keep their passwords; the rules apply to
  registration (and, later, to password changes).

## Built

- `lib/password-rules.ts` + tests
- `lib/schemas/auth.ts` — `registerSchema` uses the rules; each unmet rule is the error
- `app/(auth)/register/password-checklist.tsx` — client checklist, `aria-live` announces
  changes, each item reads "✓ met" / "○ not yet" to a screen reader
- Register form wires it in; the submit stays enabled (the server is the authority)
- **Found on the way:** both auth forms lost the typed email after a server-side error,
  because React 19 resets uncontrolled inputs when a form action returns. The register
  and login email fields are now controlled. The end-to-end test caught it — the second
  submit hit the browser's "please fill out this field".

## Verify

Preview URL: https://job-hunt-copilot-gl3vl22yc-pliatsikas-projects.vercel.app · PR: https://github.com/Pliatsikas/job-hunt-copilot/pull/1

1. `/register` — type a weak password; every rule shows unmet, submitting is refused with
   the first unmet rule named.
2. Type `Kalimera2026!` — all six tick; submit succeeds.
3. Type `ΚΑΛΗΜΕΡΑ2026!` — uppercase ticks on a Greek capital; lowercase does not.
4. Keyboard only: the checklist is read by VoiceOver / NVDA as the password changes.

## Left out

- Password change / reset flows do not exist yet; when they do, they reuse the same list.
- A breached-password check (HIBP k-anonymity) — a real improvement, a separate task.
