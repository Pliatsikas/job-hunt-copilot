import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany, findMany, runJobSearch } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findMany: vi.fn(),
  runJobSearch: vi.fn(),
}));
vi.mock("../db", () => ({ db: { lead: { updateMany }, jobPreferences: { findMany } } }));
vi.mock("./search", () => ({ runJobSearch }));

import { expireStaleLeads, formatDailyRun, LEAD_TTL_DAYS, runDailySearch, SCORED_LEAD_TTL_DAYS } from "./daily";

const NOW = new Date("2026-09-16T06:00:00Z");

beforeEach(() => {
  updateMany.mockReset().mockResolvedValue({ count: 2 });
  findMany.mockReset();
  runJobSearch.mockReset();
});

describe("expireStaleLeads", () => {
  it("retires NEW leads by age, with a longer life for ones a model call was spent on", async () => {
    const count = await expireStaleLeads(NOW);
    expect(count).toBe(2);
    const where = updateMany.mock.calls[0][0].where;
    expect(where.status).toBe("NEW");
    expect(where.OR[0]).toEqual({ matchScore: null, createdAt: { lt: new Date(NOW.getTime() - LEAD_TTL_DAYS * 86_400_000) } });
    expect(where.OR[1]).toEqual({ matchScore: { not: null }, createdAt: { lt: new Date(NOW.getTime() - SCORED_LEAD_TTL_DAYS * 86_400_000) } });
    expect(updateMany.mock.calls[0][0].data).toEqual({ status: "EXPIRED" });
  });
});

describe("runDailySearch", () => {
  it("runs opted-in users one after another and a failure does not stop the next", async () => {
    findMany.mockResolvedValue([{ userId: "a" }, { userId: "b" }, { userId: "c" }]);
    const report = { boards: 3, boardsFailed: [], postings: 10, filteredOut: 4, created: 5, alreadyKnown: 1 };
    runJobSearch
      .mockResolvedValueOnce(report)
      .mockRejectedValueOnce(new Error("Set what you are looking for on your profile first."))
      .mockResolvedValueOnce(report);

    const run = await runDailySearch(NOW);

    expect(findMany.mock.calls[0][0].where).toEqual({ autoSearch: true, NOT: { targetRoles: { isEmpty: true } } });
    expect(runJobSearch.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
    expect(run.users.map((u) => u.ok)).toEqual([true, false, true]);
    expect(run.expired).toBe(2);

    const lines = formatDailyRun(run);
    expect(lines[0]).toContain("user a: 10 postings from 3 boards · 5 new");
    expect(lines[1]).toContain("user b: FAILED");
    expect(lines.at(-1)).toContain("expired 2 stale lead(s)");
  });
});
