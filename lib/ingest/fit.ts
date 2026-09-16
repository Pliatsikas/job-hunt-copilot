import { normalizeForGrounding } from "../llm/grounding";

export type FitPreferences = {
  targetRoles: string[];
  skills: string[];
  city: string | null;
  country: string | null;
  remote: "REMOTE_ONLY" | "REMOTE_OK" | "ONSITE_OK" | "ANY";
  seniority: "JUNIOR" | "MID" | "SENIOR" | null;
  excludeKeywords: string[];
};

export type FitInput = {
  title: string;
  description: string;
  location: string | null;
  /** From the source when it says so; null when it does not. */
  remote: boolean | null;
};

export type Fit = {
  /** 0–100. Null when the posting is disqualified outright. */
  score: number | null;
  /** What matched, for the card: "role: fullstack developer", "skill: react". */
  matchedTerms: string[];
  /** Why it was disqualified, when it was. */
  excludedBy: string | null;
};

const TOKEN = "[\\p{L}\\p{N}#+.]";

/**
 * Accent-folded, and compound role words collapsed: the Greek market writes
 * "Full Stack Developer", the owner typed "fullstack developer", and a
 * posting saying "front-end" must match a preference saying "frontend". The
 * first live run surfaced Helsinki and Bangalore above Athens partly because
 * not one Greek "Full Stack" title matched the "fullstack" role.
 */
function fold(text: string): string {
  return normalizeForGrounding(text)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/\bfull[ -]?stack\b/g, "fullstack")
    .replace(/\bfront[ -]?end\b/g, "frontend")
    .replace(/\bback[ -]?end\b/g, "backend");
}

/** Words every title has; matching them alone says nothing about the role. */
const GENERIC_ROLE_WORDS = new Set(["developer", "engineer", "software", "senior", "junior", "lead", "mid", "level", "specialist", "consultant"]);

const SENIOR_WORDS = ["senior", "lead", "principal", "staff", "head of", "architect", "director", "manager"];
const JUNIOR_WORDS = ["junior", "intern", "internship", "graduate", "entry level", "trainee"];

function containsTerm(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!${TOKEN})${escaped}(?!${TOKEN})`, "u").test(haystack);
}

/** City names in Greek and Latin script, so either spelling on a posting counts. */
const CITY_ALIASES: Record<string, string[]> = {
  thessaloniki: ["thessaloniki", "θεσσαλονικη", "salonica", "saloniki"],
  athens: ["athens", "αθηνα", "attica", "αττικη"],
  patras: ["patras", "πατρα"],
  heraklion: ["heraklion", "ηρακλειο", "iraklio"],
  larissa: ["larissa", "λαρισα"],
};
const COUNTRY_ALIASES: Record<string, string[]> = {
  greece: ["greece", "ελλαδα", "hellenic", "gr"],
  germany: ["germany", "deutschland", "de"],
  cyprus: ["cyprus", "κυπρος"],
};

function aliasesFor(table: Record<string, string[]>, value: string | null): string[] {
  if (!value) return [];
  const key = fold(value);
  for (const [canon, list] of Object.entries(table)) {
    if (list.includes(key) || canon === key) return list;
  }
  return [key];
}

const REMOTE_WORDS = ["remote", "work from home", "wfh", "fully remote", "τηλεργασια", "απομακρυσμενα", "εξ αποστασεως"];

/**
 * A cheap, explainable rank, with no model call. It is not the analysis: it
 * decides which postings are worth the analysis. Weights are deliberately
 * coarse — a role in the title is most of the signal, skills in the body
 * confirm it, location and remote agree or disagree — and every hit is
 * returned by name so the card can say why.
 */
export function scoreFit(input: FitInput, prefs: FitPreferences): Fit {
  const title = fold(input.title);
  const body = fold(input.description);
  const text = `${title} ${body}`;
  const loc = fold(input.location ?? "");
  const matched: string[] = [];

  for (const word of prefs.excludeKeywords) {
    const w = fold(word);
    if (w && containsTerm(text, w)) {
      return { score: null, matchedTerms: [], excludedBy: word };
    }
  }

  let score = 0;

  // Roles: in the title is the strongest single signal there is.
  let roleInTitle = false;
  for (const role of prefs.targetRoles) {
    const r = fold(role);
    if (!r) continue;
    if (containsTerm(title, r)) {
      roleInTitle = true;
      matched.push(`role: ${role}`);
    } else if (containsTerm(body, r)) {
      matched.push(`mentions: ${role}`);
    }
  }
  if (roleInTitle) score += 45;
  else if (matched.length) score += 15;
  // Partial: individual words of a role in the title ("frontend", "developer").
  if (!roleInTitle) {
    // Only the distinctive words: "fullstack", "frontend", "ai" — not
    // "engineer", which every posting on a tech board has and which put a
    // QA role at 60 on the first live run.
    const words = new Set(
      prefs.targetRoles.flatMap((r) => fold(r).split(/\s+/)).filter((w) => w.length >= 2 && !GENERIC_ROLE_WORDS.has(w)),
    );
    const hits = [...words].filter((w) => containsTerm(title, w));
    if (hits.length) score += Math.min(20, hits.length * 10);
  }

  // Seniority: a junior looking at "Senior Lead Architect" is not a fit, and
  // the reverse is not either. Title only — bodies mention every level.
  if (prefs.seniority === "JUNIOR" && SENIOR_WORDS.some((w) => containsTerm(title, w))) score -= 20;
  if (prefs.seniority === "SENIOR" && JUNIOR_WORDS.some((w) => containsTerm(title, w))) score -= 20;
  if (prefs.seniority === "JUNIOR" && JUNIOR_WORDS.some((w) => containsTerm(title, w))) { score += 10; matched.push("junior role"); }

  // Skills in the body, diminishing returns after the fifth.
  let skillHits = 0;
  for (const skill of prefs.skills) {
    const s = fold(skill);
    if (s.length >= 2 && containsTerm(body, s)) {
      skillHits += 1;
      if (skillHits <= 8) matched.push(`skill: ${skill}`);
    }
  }
  score += Math.min(30, skillHits * 6);

  // Location and remote.
  // Title, location field, or the source's own flag — never the body. "Remote"
  // appears in the boilerplate of postings that are not ("no remote work"),
  // and on the first live run it lifted a Helsinki office job above Athens.
  const explicitRemote =
    input.remote === true || REMOTE_WORDS.some((w) => containsTerm(title, fold(w)) || containsTerm(loc, fold(w)));
  const cityHit = aliasesFor(CITY_ALIASES, prefs.city).some((a) => containsTerm(loc, a) || containsTerm(text, a));
  const countryHit = aliasesFor(COUNTRY_ALIASES, prefs.country).some((a) => containsTerm(loc, a) || containsTerm(text, a));

  // A posting that names a place, is not remote, and the place is neither the
  // owner's city nor country: it is somewhere else. Elastic's board lists
  // Bangalore next to Athens; only one of those is a job for this person.
  const elsewhere = Boolean(loc) && !explicitRemote && !cityHit && !countryHit;

  if (prefs.remote === "REMOTE_ONLY") {
    if (explicitRemote) { score += 25; matched.push("remote"); }
    else score -= 15;
  } else if (prefs.remote === "REMOTE_OK") {
    if (cityHit) { score += 25; matched.push(`in ${prefs.city}`); }
    else if (explicitRemote) { score += 20; matched.push("remote"); }
    else if (countryHit) { score += 10; matched.push(`in ${prefs.country}`); }
    else if (elsewhere) score -= 25;
  } else {
    // ONSITE_OK and ANY: local is best, remote neither helps nor hurts much.
    if (cityHit) { score += 25; matched.push(`in ${prefs.city}`); }
    else if (countryHit) { score += 12; matched.push(`in ${prefs.country}`); }
    else if (explicitRemote && prefs.remote === "ANY") { score += 10; matched.push("remote"); }
    else if (elsewhere) score -= 25;
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), matchedTerms: matched, excludedBy: null };
}
