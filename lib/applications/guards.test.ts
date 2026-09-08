import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, requireUserMock } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: requireUserMock }));
vi.mock("../db", () => ({ db: { application: { findFirst } } }));

import { requireOwnedApplication } from "./guards";

const OWNER_ROW = { id: "app-1", userId: "owner-1", roleTitle: "Backend Engineer" };

beforeEach(() => {
  vi.clearAllMocks();

  // Stands in for Postgres: a row comes back only if every field in the where
  // clause matches. If the guard ever stopped passing userId, an intruder's
  // lookup would match on id alone and this fake would hand the row over —
  // which is exactly what the intruder test below would catch.
  findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const matches = Object.entries(where).every(
      ([key, value]) => OWNER_ROW[key as keyof typeof OWNER_ROW] === value,
    );
    return matches ? OWNER_ROW : null;
  });
});

describe("requireOwnedApplication", () => {
  it("returns the application when the session user owns it", async () => {
    requireUserMock.mockResolvedValue({ id: "owner-1" });

    await expect(requireOwnedApplication("app-1")).resolves.toMatchObject({
      id: "app-1",
      userId: "owner-1",
    });
  });

  it("rejects another user's row", async () => {
    requireUserMock.mockResolvedValue({ id: "intruder-1" });

    await expect(requireOwnedApplication("app-1")).rejects.toThrow("Application not found");
  });

  it("gives an intruder the same error as a row that doesn't exist", async () => {
    requireUserMock.mockResolvedValue({ id: "intruder-1" });
    const intruder = await requireOwnedApplication("app-1").catch((e: Error) => e.message);

    requireUserMock.mockResolvedValue({ id: "owner-1" });
    const missing = await requireOwnedApplication("no-such-app").catch((e: Error) => e.message);

    expect(intruder).toBe(missing);
  });

  it("scopes the query by userId, never by id alone", async () => {
    requireUserMock.mockResolvedValue({ id: "owner-1" });
    await requireOwnedApplication("app-1");

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "app-1", userId: "owner-1" });
  });
});
