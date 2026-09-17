import type { CvSelection } from "../schemas/cv-selection";
import type { CvEntry, StructuredCv } from "../schemas/structured-cv";

export type Applied = {
  cv: StructuredCv;
  /** Ids the model returned that the CV does not have — reported, never rendered. */
  unknownIds: string[];
  /** Share of the source's bullets that made it in. */
  coverage: number;
};

/**
 * Turns the model's id list into a CV. Anything not in the source is dropped
 * and counted; skills stay in the source's order within a group; education
 * and every role are always kept (the model orders them and picks bullets),
 * projects may be thinned. Contacts, languages and interests are not the
 * model's to choose.
 */
export function applySelection(source: StructuredCv, selection: CvSelection): Applied {
  const unknown: string[] = [];

  const pickEntries = (list: CvEntry[], chosen: { id: string; bullets: string[] }[], keepAll: boolean): CvEntry[] => {
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
      const bulletIds = new Set(entry.bullets.map((b) => b.id));
      for (const b of c.bullets) if (!bulletIds.has(b)) unknown.push(b);
      const wanted = new Set(c.bullets);
      // Source order, not the model's: the owner wrote the bullets in a sequence.
      // An entry kept with none of its bullets is an entry the model forgot to
      // fill in, not a decision — it keeps all of them.
      const bullets = entry.bullets.filter((b) => wanted.has(b.id));
      out.push({ ...entry, bullets: bullets.length ? bullets : entry.bullets });
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
    about: selection.keepAbout ? source.about : "",
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

  return { cv, unknownIds: unknown, coverage: sourceBullets ? keptBullets / sourceBullets : 1 };
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
