import { normalizeForGrounding } from "../llm/grounding";

/**
 * The same posting arrives more than once: from two sources, from two runs of
 * one search, or as a repost with a fresh id. Ids therefore cannot be the
 * key. Company plus title, normalized, is — "Senior Frontend Engineer" at
 * "Acme" is one job however many times it is listed. Seniority words and
 * bracketed tags are stripped so "(Remote)" and "- m/f/d" do not split it.
 */
/**
 * Accents go too — "Εταιρεία" and "εταιρεια" are one company however the
 * posting was typed. The grounding normalizer deliberately keeps them, since
 * a quote must match the CV as written; a dedupe key has the opposite job.
 */
function fold(text: string): string {
  return normalizeForGrounding(text).normalize("NFD").replace(/\p{M}+/gu, "");
}

export function dedupeKey(companyName: string, roleTitle: string): string {
  const company = fold(companyName).replace(/[^\p{L}\p{N}]+/gu, "");
  const title = fold(roleTitle)
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(m\/f\/d|m\/w\/d|f\/m\/x|w\/m\/d|remote|hybrid|onsite)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, "-");
  return `${company}::${title}`;
}
