import { describe, expect, it } from "vitest";
import { cleanQuery, fetchJson } from "./fetch";
import { SourceError } from "./types";

describe("fetchJson host allowlist", () => {
  it("refuses any host other than the adapter's declared API host", async () => {
    // CLAUDE.md #4: never fetch a job board's pages. The allowlist is the
    // mechanism, so it is tested as one — no adapter can drift past it.
    await expect(
      fetchJson("GREENHOUSE", "boards-api.greenhouse.io", "https://www.linkedin.com/jobs/view/1"),
    ).rejects.toThrow(SourceError);
    await expect(
      fetchJson("GREENHOUSE", "boards-api.greenhouse.io", "https://boards.greenhouse.io/vercel"),
    ).rejects.toThrow(/not the GREENHOUSE API host/);
  });

  it("refuses plain http even on the right host", async () => {
    await expect(
      fetchJson("REMOTIVE", "remotive.com", "http://remotive.com/api/remote-jobs"),
    ).rejects.toThrow(SourceError);
  });
});

describe("cleanQuery", () => {
  it("keeps slugs and search terms boring", () => {
    expect(cleanQuery("  Vercel ")).toBe("vercel");
    expect(cleanQuery("full-stack dev; DROP TABLE")).toBe("full-stack dev drop table");
    expect(cleanQuery("../../etc")).toBe("....etc");
  });
});
