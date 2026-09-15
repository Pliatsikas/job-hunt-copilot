/**
 * Domains that exist to receive one email and forget it. A sign-up from one
 * is not a person who will come back, and the verification link would work
 * — a throwaway inbox is still an inbox — so the check has to happen before
 * anything is sent. Short and hand-picked: this is a sanity net, not the
 * 100,000-line lists that go stale the week they are published. The real
 * gate is the link itself.
 */
const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.fr",
  "getnada.com",
  "dispostable.com",
  "trashmail.com",
  "maildrop.cc",
  "mailnesia.com",
  "fakeinbox.com",
  "mohmal.com",
  "emailondeck.com",
  "tempr.email",
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  // Subdomain tricks: "x@mail.mailinator.com" is still mailinator.
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE.has(parts.slice(i).join("."))) return true;
  }
  return false;
}
