import type { StructuredCv } from "../schemas/structured-cv";

/**
 * Ids are short, stable and human-readable (`exp-2-b1`): the editor keeps
 * them across saves so a tailored CV made last week still points at the same
 * bullets, and a missing id fails loudly in the selection check. Assigned to
 * anything that lacks one; existing ids are kept.
 */
export function ensureIds(cv: StructuredCv): StructuredCv {
  const used = new Set<string>();
  const next = (prefix: string, existing?: string): string => {
    if (existing && !used.has(existing)) {
      used.add(existing);
      return existing;
    }
    let n = 1;
    while (used.has(`${prefix}-${n}`)) n += 1;
    used.add(`${prefix}-${n}`);
    return `${prefix}-${n}`;
  };
  const entries = (list: StructuredCv["experience"], prefix: string) =>
    list.map((e, i) => {
      const eid = next(`${prefix}-${i + 1}`, e.id);
      return {
        ...e,
        id: eid,
        bullets: e.bullets.map((b, j) => ({ ...b, id: next(`${eid}-b${j + 1}`, b.id) })),
        links: (e.links ?? []).map((l, j) => ({ ...l, id: next(`${eid}-l${j + 1}`, l.id) })),
      };
    });

  return {
    ...cv,
    contacts: cv.contacts.map((c, i) => ({ ...c, id: next(`contact-${i + 1}`, c.id) })),
    skillGroups: cv.skillGroups.map((g, i) => {
      const gid = next(`skills-${i + 1}`, g.id);
      return { ...g, id: gid, skills: g.skills.map((s, j) => ({ ...s, id: next(`${gid}-s${j + 1}`, s.id) })) };
    }),
    languages: cv.languages.map((l, i) => ({ ...l, id: next(`lang-${i + 1}`, l.id) })),
    certifications: cv.certifications.map((c, i) => ({ ...c, id: next(`cert-${i + 1}`, c.id) })),
    interests: cv.interests.map((c, i) => ({ ...c, id: next(`interest-${i + 1}`, c.id) })),
    experience: entries(cv.experience, "exp"),
    education: entries(cv.education, "edu"),
    projects: entries(cv.projects, "proj"),
  };
}
