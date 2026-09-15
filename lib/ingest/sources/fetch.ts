import type { LeadSource } from "@prisma/client";
import { SourceError } from "./types";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The one place ingestion talks to the network. It refuses any host that is
 * not the adapter's declared API host, so no adapter can drift into fetching
 * a job board's web pages — the line CLAUDE.md #4 draws and SPEC.md §6.4
 * explains. It also caps time and size, because a public API is still
 * someone else's server.
 */
export async function fetchJson<T>(
  source: LeadSource,
  allowedHost: string,
  url: string,
): Promise<T> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.host !== allowedHost) {
    throw new SourceError(source, `Refusing to fetch ${parsed.host}: not the ${source} API host.`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "job-hunt-copilot (portfolio project)" },
    });
    if (!res.ok) {
      throw new SourceError(source, `${source} answered ${res.status} for ${parsed.pathname}.`);
    }
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) {
      throw new SourceError(source, `${source} response too large (${length} bytes).`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof SourceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SourceError(source, `${source} did not answer within ${TIMEOUT_MS / 1000}s.`);
    }
    throw new SourceError(source, `${source} request failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Company slugs and search terms both go into a URL; keep them boring. */
export function cleanQuery(query: string): string {
  return query.trim().toLowerCase().replace(/[^a-z0-9 ._-]/g, "");
}
