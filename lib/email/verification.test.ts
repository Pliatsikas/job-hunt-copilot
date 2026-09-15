import { describe, expect, it } from "vitest";
import { isDisposableEmail } from "./disposable";
import { verificationEmail } from "./templates";
import { hashToken } from "./verification";

describe("isDisposableEmail", () => {
  it("refuses the well-known throwaway domains, case-insensitively", () => {
    expect(isDisposableEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@YOPMAIL.com")).toBe(true);
  });

  it("catches a subdomain of a throwaway domain", () => {
    expect(isDisposableEmail("a@mail.mailinator.com")).toBe(true);
  });

  it("does not refuse a normal provider or a company domain", () => {
    expect(isDisposableEmail("a@gmail.com")).toBe(false);
    expect(isDisposableEmail("a@uom.edu.gr")).toBe(false);
    // "mailinator" as a prefix of a real domain must not match.
    expect(isDisposableEmail("a@notmailinator.com")).toBe(false);
  });
});

describe("hashToken", () => {
  it("is deterministic and does not resemble the input", () => {
    const token = "abc123";
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("verificationEmail", () => {
  const msg = verificationEmail({ to: "a@b.com", link: "https://x.test/verify?token=T&x=1", productName: "Job Hunt Copilot" });

  it("puts the link in both the text and the html, escaped in the html", () => {
    expect(msg.text).toContain("https://x.test/verify?token=T&x=1");
    expect(msg.html).toContain("https://x.test/verify?token=T&amp;x=1");
    expect(msg.html).not.toContain("?token=T&x=1");
  });

  it("says the link expires and that an unsolicited email is harmless", () => {
    expect(msg.text).toMatch(/24 hours/);
    expect(msg.text).toMatch(/did not sign up/);
  });

  it("escapes the product name rather than trusting it", () => {
    const evil = verificationEmail({ to: "a@b.com", link: "https://x", productName: "<script>" });
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).toContain("&lt;script&gt;");
  });
});
