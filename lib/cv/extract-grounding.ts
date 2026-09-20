import type { ExtractedCv, StructuredCv } from "../schemas/structured-cv";
import { supportShare, unsupportedFacts } from "./facts";
import { resolveSource, splitSentences } from "./sentences";

/** A bullet must be at least this much the source sentence's own words. */
export const MIN_BULLET_SUPPORT = 0.5;
/** The about paragraph is composed from the whole CV; the bar is the same. */
export const MIN_ABOUT_SUPPORT = 0.5;

export type ExtractGrounding = { cv: StructuredCv; dropped: string[] };

/**
 * The extraction may write — it turns prose into CV bullets — but every fact
 * it writes must already be in the source (lib/cv/facts.ts). A string with
 * an unsupported fact is dropped and reported with the offending token, so
 * the owner sees exactly what the model tried to add. An entry whose title
 * fails is dropped whole; a bullet on its own.
 */
export function groundExtraction(cv: ExtractedCv, source: string): ExtractGrounding {
  const dropped: string[] = [];
  const sentences = splitSentences(source);
  // Labels (a name, a title, a skill) are checked strictly: their first word is
  // the fact. Prose (bullets, about) may open with any verb.
  const has = (s: string, strict = true): boolean => {
    if (!s.trim()) return true;
    const missing = unsupportedFacts(s, source, strict);
    if (missing.length === 0) return true;
    dropped.push(`${s} — not in your CV: ${missing.join(", ")}`);
    return false;
  };
  const keep = (s: string): string => (has(s) ? s : "");
  const aboutOk = (about: string): boolean => {
    if (supportShare(about, source) >= MIN_ABOUT_SUPPORT) return true;
    dropped.push(`${about} — goes beyond what your CV says`);
    return false;
  };

  // A bullet is grounded twice: its facts against the whole CV, and its
  // words against the one sentence it claims to come from — which must
  // itself be in the CV. This is what stops "Collaborated with senior
  // developers in an agile environment" appearing under a role whose only
  // source line is "web developer intern at E-Avenue".
  const bulletOk = (b: { text: string; source: string }): boolean => {
    if (!has(b.text, false)) return false;
    const src = resolveSource(b.source, sentences);
    if (!src) {
      dropped.push(`${b.text} — no sentence in your CV says this`);
      return false;
    }
    if (supportShare(b.text, src) < MIN_BULLET_SUPPORT) {
      dropped.push(`${b.text} — goes beyond what your CV says ("${src}")`);
      return false;
    }
    return true;
  };

  const entries = (list: ExtractedCv["experience"]): StructuredCv["experience"] =>
    list
      .filter((e) => has(e.title))
      .map((e) => ({
        ...e,
        org: keep(e.org),
        date: keep(e.date),
        location: keep(e.location),
        bullets: e.bullets.filter(bulletOk).map(({ id, text }) => ({ id, text })),
        links: (e.links ?? []).filter((l) => has(l.label)),
      }));

  const grounded: StructuredCv = {
    name: keep(cv.name),
    subtitle: keep(cv.subtitle),
    about: has(cv.about, false) && aboutOk(cv.about) ? cv.about : "",
    // A link is not the owner's text; it is only kept when it is a real URL.
    contacts: cv.contacts.filter((c) => has(c.value)).map((c) => ({ ...c, href: /^(https?:\/\/|mailto:|tel:)/i.test(c.href) ? c.href : "" })),
    skillGroups: cv.skillGroups
      .map((g) => ({ ...g, skills: g.skills.filter((s) => has(s.name)) }))
      .filter((g) => g.skills.length > 0),
    languages: cv.languages.filter((l) => has(l.name)).map((l) => ({ ...l, level: keep(l.level) })),
    certifications: cv.certifications.filter((c) => has(c.name)).map((c) => ({ ...c, issuer: keep(c.issuer), year: keep(c.year) })),
    interests: cv.interests.filter((i) => has(i.name)),
    experience: entries(cv.experience),
    education: entries(cv.education),
    projects: entries(cv.projects),
  };
  return { cv: grounded, dropped };
}
