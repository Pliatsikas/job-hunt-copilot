import { CV_LABELS, type CvEntry } from "@/lib/schemas/structured-cv";
import { accentStyle, ContactValue, EntryLinks, type TemplateProps, Name } from "./shared";
import styles from "./classic.module.css";

/** "Classic": one column, serif headings, hairlines. The conservative one. */
export function ClassicTemplate({ cv, language, photo, design, embedded }: TemplateProps) {
  const L = CV_LABELS[language];
  const showPhoto = design.showPhoto && Boolean(photo);
  return (
    <div className={styles.page} lang={language} style={accentStyle(design)}>
      <header className={styles.header}>
        <div>
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
        </div>
        {showPhoto && (
          // A data URL: next/image has nothing to optimise here.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.photo} src={photo ?? undefined} alt="" />
        )}
      </header>

      {cv.about && <p className={styles.about}>{cv.about}</p>}

      <Section title={L.experience} entries={cv.experience} />
      <Section title={L.education} entries={cv.education} />
      <Section title={L.projects} entries={cv.projects} />

      {cv.skillGroups.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.secTitle}>{L.skills}</h2>
          {cv.skillGroups.map((g) => (
            <div key={g.id} className={styles.skillGroup}>
              <span className={styles.skillLabel}>{g.label}: </span>
              <span>{g.skills.map((s) => s.name).join(", ")}</span>
            </div>
          ))}
        </section>
      )}

      {(cv.languages.length > 0 || cv.certifications.length > 0 || cv.interests.length > 0) && (
        <div className={styles.twoCol}>
          {cv.languages.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.secTitle}>{L.languages}</h2>
              <ul className={styles.inline}>
                {cv.languages.map((l) => (
                  <li key={l.id}>
                    <strong>{l.name}</strong>
                    {l.level && <span className={styles.muted}> — {l.level}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {cv.certifications.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.secTitle}>{L.certifications}</h2>
              <ul className={styles.inline}>
                {cv.certifications.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong>
                    {(c.issuer || c.year) && <span className={styles.muted}> — {[c.issuer, c.year].filter(Boolean).join(" · ")}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {cv.interests.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.secTitle}>{L.interests}</h2>
              <p className={styles.muted}>{cv.interests.map((i) => i.name).join(" · ")}</p>
            </section>
          )}
        </div>
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
            <div>
              <span className={styles.entryRole}>{e.title}</span>
              {e.org && <span className={styles.entryOrg}>, {e.org}</span>}
            </div>
            {e.date && <span className={styles.entryDate}>{e.date}</span>}
          </div>
          {e.location && <div className={styles.entryLoc}>{e.location}</div>}
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
