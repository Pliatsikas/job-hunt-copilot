/**
 * Contact details are stripped here, in code, before the text goes anywhere
 * near a provider. They are not needed by any prompt — no analysis has ever
 * matched a skill against a phone number — and SPEC.md §6.2 is explicit that
 * there is no reason for them to travel.
 *
 * Two identifiers are removed deterministically: email addresses and phone
 * numbers. These are unambiguous enough to catch with a pattern. Street
 * addresses and dates of birth are not — a rule that reliably found "Egnatia
 * 42" would also eat "Node 22" — so those are left to the cleanup prompt and,
 * finally, to the review screen, which exists precisely because no automatic
 * pass is trustworthy on its own.
 *
 * URLs are deliberately kept. A GitHub or portfolio link is evidence, not a
 * contact channel, and the reviewer can delete it in one keystroke.
 */

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;

/**
 * A run of digits, possibly broken by spaces, dots, dashes, parentheses or a
 * leading "+", containing at least nine digits in total. Nine, not seven: a
 * date range like "2022-2026" is eight digits and must survive, while the
 * shortest real phone number in scope (a Greek landline without country code)
 * is ten.
 */
const PHONE = /(?:\+|\(?\d)[\d\s().-]{7,}\d/g;

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

export type Redaction = {
  text: string;
  emails: number;
  phones: number;
};

export function redactContactDetails(input: string): Redaction {
  let emails = 0;
  let phones = 0;

  // Line by line, so a line that held nothing but a phone number can be
  // dropped outright while an originally blank line — a paragraph break the
  // cleanup pass may want — is left exactly where it was.
  const lines: string[] = [];
  for (const original of input.split("\n")) {
    let line = original.replace(EMAIL, () => {
      emails += 1;
      return "";
    });
    line = line.replace(PHONE, (match) => {
      if (digitCount(match) < 9) return match;
      phones += 1;
      return "";
    });
    // Closing the gap where a detail sat mid-sentence.
    line = line.replace(/[ \t]{2,}/g, " ").trim();

    const emptiedByRedaction = line === "" && original.trim() !== "";
    if (!emptiedByRedaction) lines.push(line);
  }

  return { text: lines.join("\n").trim(), emails, phones };
}
