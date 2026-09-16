/**
 * One list, used twice: the register schema enforces it on the server and the
 * sign-up form renders it as a checklist on the client. A single source means
 * the checklist can never promise something the server does not check, or
 * the other way round.
 *
 * Character classes are Unicode: a Greek capital is an uppercase letter. The
 * ASCII-only version of "uppercase" would tell a user typing ΚΑΛΗΜΕΡΑ that
 * they have no capitals — the same class of bug as `\b` in M5's detector.
 */

export type PasswordRuleId = "length" | "upper" | "lower" | "digit" | "symbol" | "common";

export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_MIN_LENGTH = 10;

/**
 * The handful of passwords that satisfy every character rule and are still
 * the first thing a script tries. Deliberately short: this is not a breach
 * list, it is a sanity check.
 */
const TOO_COMMON = new Set(
  [
    "Password1!",
    "Password123!",
    "Welcome123!",
    "Qwerty123!",
    "Admin123!",
    "Letmein123!",
    "Changeme1!",
    "P@ssw0rd!!",
    "Iloveyou1!",
    "Summer2026!",
  ].map((p) => p.toLowerCase()),
);

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => [...p].length >= PASSWORD_MIN_LENGTH,
  },
  { id: "upper", label: "An uppercase letter", test: (p) => /\p{Lu}/u.test(p) },
  { id: "lower", label: "A lowercase letter", test: (p) => /\p{Ll}/u.test(p) },
  { id: "digit", label: "A number", test: (p) => /\p{Nd}/u.test(p) },
  {
    id: "symbol",
    label: "A symbol (like ! ? # or @)",
    test: (p) => /[^\p{L}\p{N}\s]/u.test(p),
  },
  {
    id: "common",
    label: "Not a commonly used password",
    test: (p) => !TOO_COMMON.has(p.toLowerCase()),
  },
];

/** Ids of the rules a password does not meet, in list order. */
export function unmetPasswordRules(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.id);
}

export function passwordMeetsRules(password: string): boolean {
  return unmetPasswordRules(password).length === 0;
}

/** The message the server returns: the first unmet rule, by name. */
export function firstUnmetRuleLabel(password: string): string | null {
  const rule = PASSWORD_RULES.find((r) => !r.test(password));
  return rule ? `Password needs: ${rule.label.charAt(0).toLowerCase()}${rule.label.slice(1)}` : null;
}
