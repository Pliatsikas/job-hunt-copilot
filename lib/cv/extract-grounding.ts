import { normalizeForGrounding } from "../llm/grounding";
import type { StructuredCv } from "../schemas/structured-cv";

export type ExtractGrounding = { cv: StructuredCv; dropped: string[] };

/**
 * Keeps only strings that occur in the source text — the extraction cannot
 * put words in the owner's mouth. Whitespace, quote style and dash style are
 * normalised on both sides so a wrapped line still counts; anything else
 * that differs is dropped and reported. An entry whose title was dropped is
 * dropped whole; a bullet is dropped on its own.
 */
export function groundExtraction(cv: StructuredCv, source: string): ExtractGrounding {
  const haystack = normalizeForGrounding(source);
  const dropped: string[] = [];
  const has = (s: string): boolean => {
    const n = normalizeForGrounding(s);
    if (!n) return true;
    if (haystack.includes(n)) return true;
    dropped.push(s);
    return false;
  };
  const keep = (s: string): string => (has(s) ? s : "");

  const entries = (list: StructuredCv["experience"]) =>
    list
      .filter((e) => has(e.title))
      .map((e) => ({
        ...e,
        org: keep(e.org),
        date: keep(e.date),
        location: keep(e.location),
        bullets: e.bullets.filter((b) => has(b.text)),
        links: (e.links ?? []).filter((l) => has(l.label)),
      }));

  const grounded: StructuredCv = {
    name: keep(cv.name),
    subtitle: keep(cv.subtitle),
    about: keep(cv.about),
    // A link is not the owner's text; it is only kept when it is a real URL.
    contacts: cv.contacts.filter((c) => has(c.value)).map((c) => ({ ...c, href: /^(https?:\/\/|mailto:|tel:)/i.test(c.href) ? c.href : "" })),
    skillGroups: cv.skillGroups
      .map((g) => ({ ...g, label: keep(g.label) || g.label, skills: g.skills.filter((s) => has(s.name)) }))
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
