import { CV_LABELS, type CvEntry } from "@/lib/schemas/structured-cv";
import { accentStyle, ContactValue, EntryLinks, type TemplateProps, Name } from "./shared";
import styles from "./minimal.module.css";

/** "Minimal": the ATS-safe one — one column, no photo, no decoration. */
export function MinimalTemplate({ cv, language, design, embedded }: TemplateProps) {
  const L = CV_LABELS[language];
  return (
    <div className={styles.page} lang={language} style={accentStyle(design)}>
      <Name embedded={embedded} className={styles.name}>{cv.name}</Name>
      {cv.subtitle && <div className={styles.subtitle}>{cv.subtitle}</div>}
      {cv.contacts.length > 0 && (
        <ul className={styles.contacts}>
          {cv.contacts.map((c) => (
            <li key={c.id}>
              <ContactValue contact={c} />
            </li>
          ))}
        </ul>
      )}
      {cv.about && <p className={styles.about}>{cv.about}</p>}

      {cv.skillGroups.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.secTitle}>{L.skills}</h2>
          <ul className={styles.plain}>
            {cv.skillGroups.map((g) => (
              <li key={g.id}>
                <span className={styles.label}>{g.label}: </span>
                {g.skills.map((s) => s.name).join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section title={L.experience} entries={cv.experience} />
      <Section title={L.projects} entries={cv.projects} />
      <Section title={L.education} entries={cv.education} />

      {cv.certifications.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.secTitle}>{L.certifications}</h2>
          <ul className={styles.plain}>
            {cv.certifications.map((c) => (
              <li key={c.id}>{[c.name, c.issuer, c.year].filter(Boolean).join(", ")}</li>
            ))}
          </ul>
        </section>
      )}
      {cv.languages.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.secTitle}>{L.languages}</h2>
          <ul className={styles.plain}>
            {cv.languages.map((l) => (
              <li key={l.id}>{[l.name, l.level].filter(Boolean).join(" — ")}</li>
            ))}
          </ul>
        </section>
      )}
      {cv.interests.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.secTitle}>{L.interests}</h2>
          <p>{cv.interests.map((i) => i.name).join(", ")}</p>
        </section>
      )}
    </div>
  );
}

function Section({ title, entries }: { title: string; entries: CvEntry[] }) {
  if (!entries.length) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.secTitle}>{title}</h2>
      {entries.map((e) => (
        <div key={e.id} className={styles.entry}>
          <div className={styles.entryTop}>
            <span className={styles.entryRole}>{e.title}</span>
            {e.date && <span className={styles.entryDate}>{e.date}</span>}
          </div>
          {(e.org || e.location) && <div className={styles.entryMeta}>{[e.org, e.location].filter(Boolean).join(" — ")}</div>}
          {e.bullets.length > 0 && (
            <ul className={styles.bullets}>
              {e.bullets.map((b) => (
                <li key={b.id}>{b.text}</li>
              ))}
            </ul>
          )}
          <EntryLinks entry={e} className={styles.links} />
        </div>
      ))}
    </section>
  );
}
