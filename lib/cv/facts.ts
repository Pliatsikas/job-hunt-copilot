import { normalizeForGrounding } from "../llm/grounding";

/**
 * The rule that lets the model write CV text without letting it invent:
 * every *fact token* in what it writes must already exist in the owner's
 * source. A fact token is anything a recruiter could check — a number, a
 * proper noun, a technology name. Ordinary words are the model's to choose;
 * "React", "2024", "E-Avenue", "PostgreSQL" and "Rentalbook" are not.
 *
 *   - tokens containing a digit (dates, versions, counts, "Next.js 15")
 *   - tokens containing . # + / or an inner capital ("Next.js", "C#", "C++",
 *     "PostgreSQL", "TypeScript", "CI/CD")
 *   - capitalised tokens that are not at the start of a sentence (Greek too)
 *
 * The check is on the normalised text (case-folded, dashes unified), so
 * "REST APIs" in the source supports "REST API" in the output but "Vue" is
 * unsupported when the CV never says Vue.
 */
const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}.#+/\-]*/gu;
const SENTENCE_START = /(?:^|[.!?;·\n]\s*)$/u;

const ANY_DASH = /[‐‑‒–—―]/g;

export function factTokens(text: string, strict = false): string[] {
  const out: string[] = [];
  // Models like the non-breaking hyphen (U+2011): "E‑Avenue" must stay one token.
  text = text.replace(ANY_DASH, "-");
  for (const m of text.matchAll(TOKEN)) {
    const token = m[0].replace(/[.\-/]+$/u, "");
    if (!token) continue;
    const before = text.slice(0, m.index);
    // A short label ("Vue", "Senior Engineer") is all fact: no sentence-start
    // exemption for the first word.
    const atSentenceStart = !strict && SENTENCE_START.test(before);
    const hasDigit = /\p{N}/u.test(token);
    const techShape = /[.#+/]/.test(token) || /\p{Ll}\p{Lu}/u.test(token) || /^\p{Lu}{2,}$/u.test(token);
    const capitalised = /^\p{Lu}/u.test(token) && !atSentenceStart;
    if (hasDigit || techShape || capitalised) out.push(token);
  }
  return out;
}

/**
 * Fact tokens in `text` that the source does not contain, deduplicated.
 * `strict` treats every capitalised word as a fact — for names, titles and
 * skills, where the first word is not a sentence opener but the thing itself.
 */
export function unsupportedFacts(text: string, source: string, strict = false): string[] {
  const haystack = normalizeForGrounding(source);
  const found = (token: string): boolean => {
    const needle = normalizeForGrounding(token);
    // A plural/genitive tail ("APIs" for "API", "Δεδομένων" for "Δεδομένα")
    // still counts: a shortened form must appear at a word start — after a
    // space, a bracket, a slash, a dash, a comma: anything that is not a letter.
    const forms = new Set([needle, needle.replace(/(es|s)$/u, ""), needle.length > 4 ? needle.slice(0, -1) : needle]);
    return [...forms].some((f) => f && new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(f)}`, "u").test(haystack));
  };
  const missing = new Set<string>();
  for (const token of factTokens(text, strict)) {
    if (found(token)) continue;
    // "Node.js/PostgreSQL", "JWT-secured": a compound the model glued together
    // is fine when each fact-shaped part is in the CV on its own. Lowercase
    // parts ("secured") are ordinary words and not checked.
    const pieces = token.split(/[/-]/u);
    const parts = pieces.filter((p) => p && /\p{Lu}|\p{N}|[.#+]/u.test(p));
    if (pieces.length > 1 && parts.length > 0 && parts.every(found)) continue;
    missing.add(token);
  }
  return [...missing];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the text reads as the given language (script ratio), for the Greek CV. */
export function matchesLanguage(text: string, language: "el" | "en"): boolean {
  // Technology names are Latin in both languages ("Node.js", "REST", "API"),
  // so only plain words count: no digits, no tech punctuation, not all caps.
  const words = [...text.matchAll(TOKEN)].map((m) => m[0]).filter((w) => !/[\p{N}.#+/]/u.test(w) && !/^\p{Lu}{2,}$/u.test(w));
  const letters = words.join("").match(/\p{L}/gu)?.length ?? 0;
  if (!letters) return true;
  const greek = words.join("").match(/\p{Script=Greek}/gu)?.length ?? 0;
  const ratio = greek / letters;
  // Greek CVs carry Latin technology names; English CVs carry the odd Greek
  // proper noun ("1ο ΓΕΛ Τρικάλων"). The thresholds leave room for both.
  return language === "el" ? ratio > 0.5 : ratio < 0.2;
}

/**
 * The second guard, for inventions made of ordinary words. "Collaborated
 * with senior developers in an agile environment" has no fact token, so the
 * first guard lets it through; but if the CV never says collaborated, senior,
 * agile or environment, the sentence is the model's, not the owner's. Content
 * words are letters-only words of four or more characters minus a short
 * stoplist; a word counts as supported when the reference contains a word
 * with the same first five letters (plural, tense and case tails forgiven).
 */
const STOP = new Set(
  "with from that this into over under about while where when which their there these those than then also both each some such very more most much many just only same other another using used use into onto upon across within without between through during before after above below again further once here able being been have having does doing done make made makes making work works working worked year years month months".split(" "),
);

export function contentWords(text: string): string[] {
  return [...text.replace(ANY_DASH, "-").toLowerCase().matchAll(/\p{L}{4,}/gu)]
    .map((m) => m[0])
    .filter((w) => !STOP.has(w));
}

/** Share of `candidate`'s content words the reference supports (0–1; 1 when there are none). */
export function supportShare(candidate: string, reference: string): number {
  const words = contentWords(candidate);
  if (!words.length) return 1;
  const stems = new Set(contentWords(reference).map((w) => w.slice(0, 5)));
  const supported = words.filter((w) => stems.has(w.slice(0, 5))).length;
  return supported / words.length;
}

/**
 * Words that raise the candidate's level without a fact to check: a
 * fourth-year student came back as "Seasoned full-stack developer". Ordinary
 * words, so the fact guard let them through. Refused in a rewrite unless
 * the owner's own CV uses them.
 */
const SENIORITY_CLAIMS = /(?<!\p{L})(seasoned|senior|expert|veteran|extensive experience|years of experience|έμπειρος|πολυετ\p{L}*|εξειδικευμέν\p{L}*)(?!\p{L})/giu;

export function seniorityClaims(text: string, source: string): string[] {
  const haystack = source.toLowerCase();
  return [...new Set([...text.matchAll(SENIORITY_CLAIMS)].map((m) => m[1]).filter((w) => !haystack.includes(w.toLowerCase())))];
}
