# T07 — Set a password on a GitHub-only account; forgot-password

**Status:** planned · not started

## Why

The owner's account was created through GitHub and has no password. GitHub OAuth only
works on production (its callback URL is registered there — SPEC.md Α7), so on every
preview the owner cannot sign in to their own account and has to use a test account.

## Shape

- "Set a password" on the profile for accounts with none: sends a link (T02's email
  infrastructure), the link opens a set-password form using the T01 rules.
- The same flow is "forgot password" for everyone else.
- Tokens hashed, one use, short TTL — same as verification.
