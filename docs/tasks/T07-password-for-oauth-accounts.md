# T07 — Account settings: password for GitHub accounts, forgot password, change email

**Status:** done 2026-09-17 · PR #8 · verified by the owner on the preview

## Asked (owner, 2026-09-16)

The owner signs in with GitHub and has no password, so on previews (where GitHub OAuth
cannot work — its callback URL is registered on production only, SPEC.md Α7) they cannot
open their own account. They want:

1. A place to manage the account — on the profile, or a new **Settings** section.
2. On the **first sign-in with GitHub**, a prompt to set a password, so the account works
   with email + password too.
3. **Forgot password**, for everyone.
4. **Change email**, with confirmation of the new address.

## Decisions

- **Signed in = proven.** An account with no password sets one directly on Settings; the
  session is the proof of ownership, no email round trip. The same write marks the address
  verified: GitHub already checked it, and without that the new password would be refused at
  sign-in as "unconfirmed". Changing an existing password needs the current one.
- **Forgot password is a link by email**, reusing T02's machinery: the `VerificationToken`
  table, SHA-256 at rest, one live token per identifier, one use. The identifier carries the
  purpose (`reset:<email>`, `email-change:<userId>:<new email>`) so a reset link can never
  confirm an address and vice versa. One hour, not 24: these links act on an existing
  account. The token is consumed on **submit**, not on page view, so a mail client that
  prefetches links does not burn it. No schema change.
- **The forgot form is not an oracle.** Same sentence for every address; limited per address
  (3/h) and per IP (10/h).
- **Email change goes to the new address.** The old one stays in force until the link is
  opened; the old address gets a notice afterwards. "Taken" is not revealed — the reply is
  the same and the taken address simply never gets a working link. After the change the
  session's JWT still carries the old address, so the landing page signs out and the person
  signs in again with the new one.
- **The nudge is a card on Today, not a wall.** Shown while the account has no password;
  "Later" sets a cookie for 30 days in that browser. It links to Settings.
- **Settings is its own page** (`/settings`), reached from the email in the sidebar foot and
  a gear in the mobile top bar. Only account matters live there; the profile stays about
  the CV.

## Built

- `lib/account/tokens.ts` (purpose-carrying tokens), `lib/account/actions.ts` (`setPassword`,
  `changePassword`, `requestPasswordReset`, `resetPassword`, `requestEmailChange`,
  `confirmEmailChange`, `dismissPasswordNudge`), `lib/account/queries.ts`.
- `lib/email/templates.ts`: one `systemEmail()` layout; reset, email-change and
  email-changed-notice emails built on it.
- Pages: `/settings` (app), `/forgot`, `/reset?token=`, `/email-change?token=` (auth, public).
  Login: "Forgot your password?" link and the two return messages. Today: the nudge card.
- Tests: `lib/account/tokens.test.ts`; the happy path now changes the password on Settings,
  signs in with it, then walks the forgot-password link (used once, refused twice). The
  email-change flow was probed end to end against a local production build with the log
  email provider: link to the new address → "Email changed" → sign in with the new one →
  second use refused → notice to the old address.

## Verify

https://job-hunt-copilot-mna7441b6-pliatsikas-projects.vercel.app — with the test account: Settings → change the password (then
sign in with it); "Forgot your password?" on the login page (the email arrives from Brevo,
check spam); change the email to another address you own and open the link there.

**The nudge cannot be seen on a preview** (GitHub sign-in only works on production). After the
merge: sign in on production with GitHub → Today shows "Set a password on your account" →
Settings → set it. From then on the owner's own account opens on every preview with
email + password.
