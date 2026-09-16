# T07 — Account settings: password for GitHub accounts, forgot password, change email

**Status:** planned · next after T05

## Asked (owner, 2026-09-16)

The owner signs in with GitHub and has no password, so on previews (where GitHub OAuth
cannot work — its callback URL is registered on production only, SPEC.md Α7) they cannot
open their own account. They want:

1. A place to manage the account — on the profile, or a new **Settings** section.
2. On the **first sign-in with GitHub**, a prompt to set a password, so the account works
   with email + password too.
3. **Forgot password**, for everyone.
4. **Change email**, with confirmation of the new address.

## Shape

- Settings page (`/settings`): email (with "change"), password ("set" or "change"), sign out
  everywhere later if needed. Reached from the account block in the shell.
- Set / reset password is one flow: a link by email (T02's infrastructure), one use, hashed
  token, short TTL; the landing form uses the T01 rules and checklist. "Set a password" on
  settings and "Forgot password?" on the login page both start it.
- First GitHub sign-in: the `signIn` callback / a check in the app layout sends an account
  with no password hash to `/settings/password?first=1` once, with a "later" link. Not a
  wall — a nudge that appears once per account.
- Change email: a link to the **new** address confirms it; the old address gets a notice.
  Until confirmed the old email stays in force.
