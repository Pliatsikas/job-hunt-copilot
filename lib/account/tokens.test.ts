import { describe, expect, it } from "vitest";
import { emailChangeIdentifier, parseIdentifier, resetIdentifier } from "./tokens";

describe("account token identifiers", () => {
  it("round-trips a reset identifier", () => {
    expect(parseIdentifier(resetIdentifier("a@b.com"))).toEqual({ ok: true, purpose: "reset", email: "a@b.com" });
  });
  it("round-trips an email-change identifier, splitting on the first colon only", () => {
    expect(parseIdentifier(emailChangeIdentifier("user_1", "x:y@b.com"))).toEqual({
      ok: true,
      purpose: "email-change",
      userId: "user_1",
      newEmail: "x:y@b.com",
    });
  });
  it("rejects a sign-up confirmation identifier (a bare email) and malformed ones", () => {
    expect(parseIdentifier("a@b.com")).toBeNull();
    expect(parseIdentifier("reset:")).toBeNull();
    expect(parseIdentifier("email-change:user")).toBeNull();
    expect(parseIdentifier("email-change::a@b.com")).toBeNull();
  });
});
