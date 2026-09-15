/**
 * Job APIs hand back descriptions as HTML — Greenhouse even HTML-escapes the
 * HTML — and the analysis wants prose. This is a text extraction, not a
 * parser: block elements become line breaks, entities are decoded, tags go.
 * No dependency, because the input is trusted API JSON rather than a web
 * page, and the failure mode of a stray tag surviving is a stray tag in a
 * job description, not a security problem.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•",
  middot: "·",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

// Closing </li> is deliberately absent: the opening tag already starts the
// bullet on its own line, and a break on close would double-space every list.
const BLOCK = /<\/?(p|div|br|ul|ol|h[1-6]|tr|section|article|header|footer|blockquote)\b[^>]*>|<\/li>/gi;

export function htmlToText(input: string): string {
  // Greenhouse escapes the markup itself, so decode first, then strip; a
  // plain-text description with a literal "&amp;" comes out right either way.
  let text = decodeEntities(input);
  // Second pass for the escaped-HTML case where the first decode revealed tags.
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/li>/gi, "")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(BLOCK, "\n")
    .replace(/<[^>]+>/g, "");
  text = decodeEntities(text);
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
