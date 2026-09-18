import type { AnalysisResult } from "../schemas/analysis";
import type { CvSelection } from "../schemas/cv-selection";
import type { CvEntry, CvLanguage, StructuredCv } from "../schemas/structured-cv";
import { normalizeForGrounding } from "../llm/grounding";
import { matchesLanguage, supportShare, unsupportedFacts } from "./facts";

/** A rewrite must be mostly the owner's words — from the bullet, the CV, or the posting's allowed keywords. */
export const MIN_REWRITE_SUPPORT = 0.5;

/**
 * The posting's vocabulary the rewrites may use: the skills the analysis
 * matched against the CV (with evidence) and the keywords it says to mirror
 * — minus anything it listed as a gap. "RAG" is allowed when the CV says
 * "Retrieval-Augmented Generation"; "Kubernetes" is not when the CV has
 * never met it, however much the posting wants it.
 */
export function allowedPostingTerms(analysis: AnalysisResult): string[] {
  const gaps = new Set(analysis.gaps.map((g) => normalizeForGrounding(g.skill)));
  const terms = [...analysis.matchedSkills.map((m) => m.skill), ...analysis.keywordsToMirror];
  return [...new Set(terms.filter((t) => t.trim() && !gaps.has(normalizeForGrounding(t))))];
}

export type CvChange = { id: string; from: string; to: string };
export type CvRejection = { id: string; text: string; reason: string };

export type Applied = {
  cv: StructuredCv;
  /** Ids the model returned that the CV does not have — reported, never rendered. */
  unknownIds: string[];
  /** Rewrites that were used: what the owner wrote → what the document says. */
  changes: CvChange[];
  /** Rewrites refused (an invented fact, the wrong language) — the original stands. */
  rejected: CvRejection[];
  /** Share of the source's bullets that made it in. */
  coverage: number;
};

/**
 * Turns the model's answer into a CV. Ids not in the source are dropped and
 * counted; skills stay in the source's order within a group; education and
 * every role are always kept (the model orders them and picks bullets),
 * projects may be thinned; an entry kept with none of its bullets keeps all
 * of them. Contacts, languages and interests are not the model's to choose.
 *
 * A rewrite replaces the owner's bullet only when every fact in it already
 * exists in the owner's CV — or is one of `allowedTerms`: the posting's
 * keywords that the analysis matched against the CV (the owner asked for
 * the posting's vocabulary to be worked in; a keyword the analysis listed as
 * a gap is not in this list and is refused). It must also read in the CV's
 * language. Anything else falls back to the original and is reported, so
 * the owner can see what the model wanted to say and why it was not allowed.
 */
export function applySelection(
  source: StructuredCv,
  selection: CvSelection,
  language: CvLanguage,
  sourceText: string,
  allowedTerms: string[] = [],
): Applied {
  const unknown: string[] = [];
  const changes: CvChange[] = [];
  const rejected: CvRejection[] = [];
  const allowed = allowedTerms.join("\n");
  const cvAndAllowed = `${sourceText}\n${allowed}`;

  /**
   * `scope` is the text a rewrite may draw CV facts from: the entry it
   * belongs to for a bullet, the whole CV for the about paragraph. A bullet
   * about the Electron app may not borrow "E-Avenue" or "~2,600 records"
   * from another entry. The posting's allowed keywords are exempt: the
   * owner wants them woven in wherever they read naturally.
   */
  const rewriteOf = (id: string, original: string, proposed: string, scope: string): string => {
    const text = proposed.trim();
    if (!text || text === original) return original;
    const missing = unsupportedFacts(text, cvAndAllowed);
    if (missing.length) {
      rejected.push({ id, text, reason: `not in your CV: ${missing.join(", ")}` });
      return original;
    }
    const outOfScope = unsupportedFacts(text, `${scope}\n${allowed}`);
    if (outOfScope.length) {
      rejected.push({ id, text, reason: `not part of this entry: ${outOfScope.join(", ")}` });
      return original;
    }
    if (!matchesLanguage(text, language)) {
      rejected.push({ id, text, reason: "wrong language" });
      return original;
    }
    // Facts can be right and the sentence still invented ("Led agile
    // ceremonies" out of "worked in a team"): most of its words must be the
    // owner's, from this bullet or anywhere in the CV.
    if (supportShare(text, `${original}\n${cvAndAllowed}`) < MIN_REWRITE_SUPPORT) {
      rejected.push({ id, text, reason: "says more than your CV does" });
      return original;
    }
    changes.push({ id, from: original, to: text });
    return text;
  };

  const pickEntries = (list: CvEntry[], chosen: { id: string; bullets: { id: string; text: string }[] }[], keepAll: boolean): CvEntry[] => {
    const byId = new Map(list.map((e) => [e.id, e]));
    const out: CvEntry[] = [];
    const seen = new Set<string>();
    for (const c of chosen) {
      const entry = byId.get(c.id);
      if (!entry) {
        unknown.push(c.id);
        continue;
      }
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const proposed = new Map<string, string>();
      for (const b of c.bullets) {
        if (entry.bullets.some((x) => x.id === b.id)) proposed.set(b.id, b.text);
        else unknown.push(b.id);
      }
      // Source order, not the model's: the owner wrote the bullets in a sequence.
      let bullets = entry.bullets.filter((b) => proposed.has(b.id));
      if (!bullets.length) bullets = entry.bullets;
      const scope = [entry.title, entry.org, entry.date, entry.location, ...entry.bullets.map((b) => b.text), ...(entry.links ?? []).map((l) => l.label)].join("\n");
      out.push({ ...entry, bullets: bullets.map((b) => ({ ...b, text: rewriteOf(b.id, b.text, proposed.get(b.id) ?? "", scope) })) });
    }
    if (keepAll) {
      for (const e of list) if (!seen.has(e.id)) out.push(e);
    }
    return out;
  };

  const groupById = new Map(source.skillGroups.map((g) => [g.id, g]));
  const skillGroups = [];
  const seenGroups = new Set<string>();
  for (const g of selection.skillGroups) {
    const group = groupById.get(g.id);
    if (!group) {
      unknown.push(g.id);
      continue;
    }
    if (seenGroups.has(g.id)) continue;
    seenGroups.add(g.id);
    const ids = new Set(group.skills.map((s) => s.id));
    for (const s of g.skills) if (!ids.has(s)) unknown.push(s);
    const wanted = new Set(g.skills);
    const skills = group.skills.filter((s) => wanted.has(s.id));
    if (skills.length) skillGroups.push({ ...group, skills });
  }

  const certIds = new Set(source.certifications.map((c) => c.id));
  for (const c of selection.certifications) if (!certIds.has(c)) unknown.push(c);
  const wantedCerts = new Set(selection.certifications);

  const cv: StructuredCv = {
    ...source,
    about: selection.keepAbout ? rewriteOf("about", source.about, selection.about, sourceText) : "",
    skillGroups,
    certifications: source.certifications.filter((c) => wantedCerts.has(c.id)),
    // Every role stays — a CV with a job missing reads as a gap, not a choice.
    // Projects are the one list the model may thin out.
    experience: pickEntries(source.experience, selection.experience, true),
    education: pickEntries(source.education, selection.education, true),
    projects: pickEntries(source.projects, selection.projects, false),
  };

  const sourceBullets = [...source.experience, ...source.education, ...source.projects].reduce((n, e) => n + e.bullets.length, 0);
  const keptBullets = [...cv.experience, ...cv.education, ...cv.projects].reduce((n, e) => n + e.bullets.length, 0);

  return { cv, unknownIds: unknown, changes, rejected, coverage: sourceBullets ? keptBullets / sourceBullets : 1 };
}

/** The document's plain-text form: what copy and .md download give. */
export function renderStructuredCvText(cv: StructuredCv, labels: Record<string, string>): string {
  const lines: string[] = [cv.name];
  if (cv.subtitle) lines.push(cv.subtitle);
  if (cv.contacts.length) lines.push(cv.contacts.map((c) => c.value).join(" · "));
  if (cv.about) lines.push("", cv.about);
  const entries = (label: string, list: CvEntry[]) => {
    if (!list.length) return;
    lines.push("", label.toUpperCase());
    for (const e of list) {
      lines.push([e.title, e.org].filter(Boolean).join(" · ") + (e.date ? ` (${e.date})` : ""));
      if (e.location) lines.push(e.location);
      for (const b of e.bullets) lines.push(`- ${b.text}`);
      for (const l of e.links ?? []) lines.push(`  ${l.label}: ${l.href}`);
    }
  };
  entries(labels.experience, cv.experience);
  entries(labels.education, cv.education);
  entries(labels.projects, cv.projects);
  if (cv.skillGroups.length) {
    lines.push("", labels.skills.toUpperCase());
    for (const g of cv.skillGroups) lines.push(`${g.label}: ${g.skills.map((s) => s.name).join(", ")}`);
  }
  if (cv.languages.length) lines.push("", labels.languages.toUpperCase(), ...cv.languages.map((l) => `${l.name}${l.level ? ` — ${l.level}` : ""}`));
  if (cv.certifications.length) lines.push("", labels.certifications.toUpperCase(), ...cv.certifications.map((c) => [c.name, c.issuer, c.year].filter(Boolean).join(" · ")));
  if (cv.interests.length) lines.push("", labels.interests.toUpperCase(), cv.interests.map((i) => i.name).join(", "));
  return lines.join("\n");
}
