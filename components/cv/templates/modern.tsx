import { CV_LABELS, type CvEntry } from "@/lib/schemas/structured-cv";
import { accentStyle, ContactIcon, ContactValue, EntryLinks, type TemplateProps, Name } from "./shared";
import styles from "./modern.module.css";

/** "Modern": accent band, wide main column, narrow side column with pills. */
export function ModernTemplate({ cv, language, photo, design, embedded }: TemplateProps) {
  const L = CV_LABELS[language];
  const showPhoto = design.showPhoto && Boolean(photo);
  return (
    <div className={styles.page} lang={language} style={accentStyle(design)}>
      <header className={styles.band}>
        <div>
          <Name embedded={embedded} className={styles.name}>{cv.name}</Name>
          {cv.subtitle && <div className={styles.subtitle}>{cv.subtitle}</div>}
          {cv.contacts.length > 0 && (
            <ul className={styles.contacts}>
              {cv.contacts.map((c) => (
                <li key={c.id}>
                  <span className={styles.icon} aria-hidden>
                    <ContactIcon kind={c.kind} />
                  </span>
                  <ContactValue contact={c} />
                </li>
              ))}
            </ul>
          )}
        </div>
        {showPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.photo} src={photo ?? undefined} alt="" />
        )}
      </header>

      <div className={styles.body}>
        <main>
          {cv.about && <p className={styles.about}>{cv.about}</p>}
          <Section title={L.experience} entries={cv.experience} />
          <Section title={L.projects} entries={cv.projects} />
          <Section title={L.education} entries={cv.education} />
        </main>

        <aside className={styles.side}>
          {cv.skillGroups.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.secTitle}>{L.skills}</h2>
              {cv.skillGroups.map((g) => (
                <div key={g.id} className={styles.skillGroup}>
                  <div className={styles.skillLabel}>{g.label}</div>
                  <div className={styles.pills}>
                    {g.skills.map((s) => (
                      <span key={s.id} className={styles.pill}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
          {cv.languages.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.secTitle}>{L.languages}</h2>
              {cv.languages.map((l) => (
                <div key={l.id} className={styles.row}>
                  <span>{l.name}</span>
                  <span className={styles.muted}>{l.level}</span>
                </div>
              ))}
            </section>
          )}
          {cv.certifications.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.secTitle}>{L.certifications}</h2>
              {cv.certifications.map((c) => (
                <div key={c.id} className={styles.cert}>
                  <strong>{c.name}</strong>
                  {(c.issuer || c.year) && <span className={styles.muted}>{[c.issuer, c.year].filter(Boolean).join(" · ")}</span>}
                </div>
              ))}
            </section>
          )}
          {cv.interests.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.secTitle}>{L.interests}</h2>
              <div className={styles.pills}>
                {cv.interests.map((i) => (
                  <span key={i.id} className={styles.pill}>
                    {i.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
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
              {e.org && <span className={styles.entryOrg}> · {e.org}</span>}
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
