import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "./cron-auth";

describe("isAuthorizedCron", () => {
  it("accepts exactly the bearer token Vercel sends", () => {
    expect(isAuthorizedCron("Bearer s3cret", "s3cret")).toBe(true);
  });
  it("refuses a wrong, missing or differently-shaped header", () => {
    expect(isAuthorizedCron("Bearer nope", "s3cret")).toBe(false);
    expect(isAuthorizedCron("s3cret", "s3cret")).toBe(false);
    expect(isAuthorizedCron(null, "s3cret")).toBe(false);
    expect(isAuthorizedCron("Bearer s3cret ", "s3cret")).toBe(false);
  });
  it("refuses everything when no secret is configured — a dev server is never a cron target", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });
});
