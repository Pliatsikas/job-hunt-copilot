import { CV_LABELS, type CvEntry } from "@/lib/schemas/structured-cv";
import { accentStyle, ContactIcon, ContactValue, EntryLinks, type TemplateProps, Name } from "./shared";
import styles from "./sidebar.module.css";

/**
 * "Sidebar": the owner's own CV design (T09). A dark column with the photo,
 * contact, skills, languages, certifications and interests; a light main
 * column with name, subtitle, about, experience, education, projects. No
 * state: what it prints is exactly what it was given.
 */
export function SidebarTemplate({ cv, language, photo, design, embedded }: TemplateProps) {
  const L = CV_LABELS[language];
  const showPhoto = design.showPhoto && Boolean(photo);
  return (
    <div className={styles.page} lang={language} style={accentStyle(design)}>
      <aside className={styles.sidebar}>
        {showPhoto && (
          <div className={styles.photoWrap}>
            {/* A data URL: next/image would only add a proxy hop for nothing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo ?? undefined} alt="" />
          </div>
        )}
        <div className={styles.sidebarInner}>
          {cv.contacts.length > 0 && (
            <div>
              <div className={styles.sTitle}>{L.contact}</div>
              <ul className={styles.contactList}>
                {cv.contacts.map((c) => (
                  <li key={c.id}>
                    <span className={styles.icon} aria-hidden>
                      <ContactIcon kind={c.kind} />
                    </span>
                    <ContactValue contact={c} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cv.skillGroups.length > 0 && (
            <div>
              <div className={styles.sTitle}>{L.skills}</div>
              {cv.skillGroups.map((g) => (
                <div key={g.id} className={styles.skillGroup}>
                  <div className={styles.sgLabel}>{g.label}</div>
                  <div className={styles.skillTags}>
                    {g.skills.map((s) => (
                      <span key={s.id} className={styles.tag}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {cv.languages.length > 0 && (
            <div>
              <div className={styles.sTitle}>{L.languages}</div>
              {cv.languages.map((l) => (
                <div key={l.id} className={styles.langRow}>
                  <span>{l.name}</span>
                  <span>{l.level}</span>
                </div>
              ))}
            </div>
          )}

          {cv.certifications.length > 0 && (
            <div>
              <div className={styles.sTitle}>{L.certifications}</div>
              <ul className={styles.certList}>
                {cv.certifications.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong>
                    {c.issuer || c.year ? ` — ${[c.issuer, c.year].filter(Boolean).join(" · ")}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cv.interests.length > 0 && (
            <div>
              <div className={styles.sTitle}>{L.interests}</div>
              <div className={styles.interestList}>
                {cv.interests.map((i) => (
                  <span key={i.id} className={styles.interestPill}>
                    {i.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className={styles.main}>
        <div>
          <Name embedded={embedded} className={styles.headerName}>{cv.name}</Name>
          {cv.subtitle && <div className={styles.headerSub}>{cv.subtitle}</div>}
          {cv.about && <p className={styles.headerAbout}>{cv.about}</p>}
        </div>
        <Section title={L.experience} entries={cv.experience} />
        <Section title={L.education} entries={cv.education} />
        <Section title={L.projects} entries={cv.projects} />
      </main>
    </div>
  );
}

function Section({ title, entries }: { title: string; entries: CvEntry[] }) {
  if (!entries.length) return null;
  return (
    <div>
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
    </div>
  );
}
