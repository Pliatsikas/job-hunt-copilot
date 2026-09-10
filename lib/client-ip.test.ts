import { describe, expect, it } from "vitest";
import { clientIpFrom } from "./client-ip";

describe("clientIpFrom", () => {
  it("prefers x-real-ip, which the platform sets itself", () => {
    const headers = new Headers({
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1, 203.0.113.7",
    });
    expect(clientIpFrom(headers)).toBe("203.0.113.7");
  });

  it("takes the first entry of x-forwarded-for, not the last", () => {
    // The client is leftmost; the rest are proxies. Keying on the last entry
    // would put every visitor behind one shared bucket.
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.5, 10.0.0.9" });
    expect(clientIpFrom(headers)).toBe("198.51.100.1");
  });

  it("trims whitespace around the address", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "  198.51.100.1 , 10.0.0.5" }))).toBe(
      "198.51.100.1",
    );
  });

  it("falls back to one shared bucket when no header is present", () => {
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });

  it("ignores an empty header rather than keying on the empty string", () => {
    const headers = new Headers({ "x-real-ip": "   ", "x-forwarded-for": "198.51.100.1" });
    expect(clientIpFrom(headers)).toBe("198.51.100.1");
  });
});
