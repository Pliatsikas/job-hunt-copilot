import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock("./fetch", async (importActual) => {
  const actual = await importActual<typeof import("./fetch")>();
  return { ...actual, fetchJson };
});

import { arbeitnow } from "./arbeitnow";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { remotive } from "./remotive";
import { SOURCES } from "./index";
import { SourceError } from "./types";

afterEach(() => vi.clearAllMocks());

describe("greenhouse", () => {
  it("normalises the real response shape, decoding the escaped HTML body", async () => {
    // Trimmed from a live call to boards-api.greenhouse.io/v1/boards/vercel/jobs.
    fetchJson.mockResolvedValueOnce({
      jobs: [
        {
          id: 6136160004,
          title: "Account Executive, Commercial",
          absolute_url: "https://job-boards.greenhouse.io/vercel/jobs/6136160004",
          location: { name: "Hybrid - London" },
          company_name: "Vercel",
          first_published: "2026-08-01T10:00:00-04:00",
          content: "&lt;div&gt;&lt;h2&gt;About Vercel:&lt;/h2&gt;&lt;p&gt;We ship &amp; scale.&lt;/p&gt;&lt;/div&gt;",
        },
      ],
    });

    const [job] = await greenhouse.fetchJobs("Vercel");
    expect(fetchJson).toHaveBeenCalledWith(
      "GREENHOUSE",
      "boards-api.greenhouse.io",
      "https://boards-api.greenhouse.io/v1/boards/vercel/jobs?content=true",
    );
    expect(job).toMatchObject({
      externalId: "6136160004",
      companyName: "Vercel",
      roleTitle: "Account Executive, Commercial",
      location: "Hybrid - London",
      jobDescription: "About Vercel:\n\nWe ship & scale.",
    });
    expect(job.postedAt).toBeInstanceOf(Date);
  });

  it("falls back to the slug when the API omits the company name", async () => {
    fetchJson.mockResolvedValueOnce({ jobs: [{ id: 1, title: "Dev", content: "" }] });
    const [job] = await greenhouse.fetchJobs("acme");
    expect(job.companyName).toBe("acme");
  });
});

describe("lever", () => {
  it("turns the not-found object into a named error rather than an empty list", async () => {
    // Lever answers { ok: false } with 200 for an unknown slug.
    fetchJson.mockResolvedValue({ ok: false, error: "Document not found" });
    await expect(lever.fetchJobs("nobody")).rejects.toThrow(SourceError);
    await expect(lever.fetchJobs("nobody")).rejects.toThrow(/no board "nobody"/);
  });

  it("prefers descriptionPlain and reads the epoch-millisecond date", async () => {
    fetchJson.mockResolvedValueOnce([
      {
        id: "abc",
        text: "Backend Engineer",
        hostedUrl: "https://jobs.lever.co/x/abc",
        descriptionPlain: "Build APIs.",
        description: "<p>Build APIs.</p>",
        createdAt: 1757000000000,
        categories: { location: "Athens" },
      },
    ]);
    const [job] = await lever.fetchJobs("x");
    expect(job).toMatchObject({ externalId: "abc", roleTitle: "Backend Engineer", jobDescription: "Build APIs.", location: "Athens" });
    expect(job.postedAt?.getTime()).toBe(1757000000000);
  });
});

describe("arbeitnow and remotive", () => {
  it("arbeitnow: seconds epoch, slug as id, HTML description stripped", async () => {
    fetchJson.mockResolvedValueOnce({
      data: [{ slug: "dev-1", company_name: "Digital Beat GmbH", title: "Werkstudent KI", description: "<p>Hi</p>", url: "https://x", location: "Köln", created_at: 1757000000 }],
    });
    const [job] = await arbeitnow.fetchJobs("typescript");
    expect(job).toMatchObject({ externalId: "dev-1", companyName: "Digital Beat GmbH", jobDescription: "Hi", location: "Köln" });
    expect(job.postedAt?.getTime()).toBe(1757000000000);
  });

  it("remotive: defaults location to Remote when the API leaves it blank", async () => {
    fetchJson.mockResolvedValueOnce({ jobs: [{ id: 9, title: "React Dev", company_name: "Co", description: "x", candidate_required_location: "" }] });
    const [job] = await remotive.fetchJobs("react");
    expect(job.location).toBe("Remote");
  });
});

describe("the registry", () => {
  it("has an adapter for every LeadSource, each pinned to one API host", () => {
    for (const [name, adapter] of Object.entries(SOURCES)) {
      expect(adapter.source).toBe(name);
      expect(adapter.host).toMatch(/^[a-z0-9.-]+$/);
      expect(adapter.host).not.toMatch(/linkedin|indeed|kariera|jobfind/);
    }
  });
});
