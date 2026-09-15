import { describe, expect, it } from "vitest";
import { redactContactDetails } from "./redact";

describe("redactContactDetails", () => {
  it("removes email addresses, including Greek-domain ones", () => {
    const out = redactContactDetails("Contact: alex.p@example.com or αλεξ@παράδειγμα.ελ today");
    expect(out.text).not.toMatch(/@/);
    expect(out.emails).toBe(2);
  });

  it("removes phone numbers in the formats a Greek CV uses", () => {
    const cases = [
      "+30 694 123 4567",
      "+30-6941234567",
      "6941234567",
      "(+30) 2310 123456",
      "2310.123.456",
    ];
    for (const phone of cases) {
      const out = redactContactDetails(`Phone: ${phone}\nNext line`);
      expect(out.text, phone).not.toContain(phone.replace(/\D/g, "").slice(-4));
      expect(out.phones, phone).toBe(1);
    }
  });

  it("leaves year ranges and short numbers alone", () => {
    // Eight digits total; a phone needs nine. "Node 22" and "React 18" are
    // the other shape that must survive.
    const text = "University of Macedonia, 2022–2026\nNode 22, React 18, PostgreSQL 16\nTaskFlow, 2026.";
    const out = redactContactDetails(text);
    expect(out.text).toBe(text);
    expect(out.phones).toBe(0);
  });

  it("keeps URLs — a GitHub link is evidence, not a contact channel", () => {
    const out = redactContactDetails("github.com/Pliatsikas\nlinkedin.com/in/alexandros-pliatsikas");
    expect(out.text).toContain("github.com/Pliatsikas");
    expect(out.text).toContain("linkedin.com/in/alexandros-pliatsikas");
  });

  it("drops the line entirely when the contact detail was all it held", () => {
    const out = redactContactDetails("Thessaloniki, Greece\n+30 694 123 4567\nalex@example.com\nSKILLS");
    expect(out.text).toBe("Thessaloniki, Greece\nSKILLS");
  });

  it("closes the gap when the detail sat mid-sentence", () => {
    const out = redactContactDetails("Reach me at alex@example.com for details.");
    expect(out.text).toBe("Reach me at for details.");
  });

  it("does not mangle a CV with nothing to redact", () => {
    const text = "I build React frontends with TypeScript.\nI design PostgreSQL schemas.";
    expect(redactContactDetails(text)).toEqual({ text, emails: 0, phones: 0 });
  });
});

describe("blank lines", () => {
  it("keeps a paragraph break the author put there", () => {
    const text = "PROFILE\nI build things.\n\nEXPERIENCE\nI built more things.";
    expect(redactContactDetails(text).text).toBe(text);
  });
});
