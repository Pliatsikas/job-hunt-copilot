# T02 — Email verification on sign-up

**Status:** in progress · **Branch:** `task/02-email-verification`

## Asked (owner, 2026-09-15)

Anyone who signs up with an email must verify it — we send an email — and registration must
not accept "whatever" as an address. Provider: **Brevo** (owner's choice; free tier, verified
sender address, no domain needed). The owner notes Brevo warned that without a domain the
mail may land in spam, so the UI must say to check there.

## Decisions

- **Brevo behind an interface.** `lib/email/types.ts` defines `EmailProvider.send()`;
  `lib/email/providers/brevo.ts` is one adapter over its REST API with `fetch` — no SDK, no
  new dependency. `lib/email/index.ts` picks by env, and a `log` provider prints to the
  server console when `BREVO_API_KEY` is unset, so local dev and the end-to-end suite never
  send mail.
- **Tokens are hashed at rest.** The link carries a random 32-byte token; the database stores
  its SHA-256. A leaked table cannot be replayed. Reuses Auth.js's `VerificationToken` model
  (identifier = email, token = hash, expires = +24h).
- **The account exists before verification, but cannot sign in.** `authorize()` refuses a
  user whose `emailVerified` is null with a message that says so and offers a resend. Creating
  the row first means the email is reserved and the resend flow has something to resend to.
- **"Not any email":** three nets. Syntax (already). A short disposable-domain blocklist in
  code (`lib/email/disposable.ts`) — mailinator, guerrillamail, 10minutemail and kin —
  refused at registration with a plain message. And the link itself: an inbox that does not
  exist never activates the account.
- **Resend is rate-limited** through the existing `RateLimit` table: 3 per email per hour.
  The resend form never says whether the address is registered — the same enumeration rule as
  login.
- **Unverified accounts expire.** Rows with `emailVerified = null` older than 7 days are
  deleted opportunistically alongside the rate-limit prune. The email becomes registrable
  again; nothing else was attached to the account.
- **Existing accounts are grandfathered** by the migration: every current `emailVerified IS
  NULL` row is set to the migration time. The owner and the demo are not asked to verify
  what they already use. Sign-ups after this ship are not.
- **GitHub OAuth is untouched.** GitHub has verified the address; the adapter sets
  `emailVerified` itself.
- **Spam note in the UI.** The "check your inbox" screen says, in so many words, to look in
  spam and why — the sender is a plain mailbox, not a domain with DKIM.
- **Email design:** plain, one column, dark text on white, one button, the raw link printed
  under it for clients that strip buttons, a plain-text alternative. Nothing that trips a
  spam filter harder than a bare mailbox already does.

## Built

- `lib/email/` — `types.ts`, `providers/brevo.ts` (REST, no SDK), `providers/log.ts`,
  `index.ts` (env-selected), `templates.ts`, `verification.ts` (hashed tokens, consume,
  prune), `disposable.ts`, `send-verification.ts` (link uses the request's own host, so
  previews send preview links), `resend.ts` (rate-limited, no enumeration)
- `lib/register.ts` — disposable check → create unverified → send → `/verify/sent`
- `lib/auth.ts` — `authorize()` throws `unverified` only after the password matched
- `lib/login.ts` + login form — the message, with a resend link
- `app/(auth)/verify/page.tsx`, `app/(auth)/verify/sent/` — landing and inbox pages
- Migration `grandfather_email_verified` — every pre-existing account marked verified
- Seed marks the demo verified
- E2E: register lands on inbox page, disposable refused, login refused until confirmed,
  link confirms once and explains on reuse
- Verified locally against the real Brevo key: a message reached the owner's inbox

## Verify

Preview URL: https://job-hunt-copilot-eb6hb6lcb-pliatsikas-projects.vercel.app · PR: https://github.com/Pliatsikas/job-hunt-copilot/pull/2

1. Register with your own email and a strong password → "check your inbox" screen, with the
   spam note. Email arrives (spam folder counts). Link opens `/verify?token=…` → "verified,
   sign in" → sign in works.
2. Before clicking the link, try to sign in → refused, with a resend link. Resend sends
   again. A fourth resend within the hour is refused.
3. Register with `x@mailinator.com` → refused before anything is sent.
4. Click the link twice → second time says it was already used / expired, no error page.
5. Sign in as demo → works without any verification (grandfathered).

## Left out

- Change-of-email flow (would need re-verification). No such feature exists yet.
- DKIM/SPF — needs a domain. When one exists, only `EMAIL_FROM` changes.
