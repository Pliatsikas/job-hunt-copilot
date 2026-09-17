import { CV_LABELS, type CvContact, type CvEntry, type CvLanguage, type StructuredCv } from "@/lib/schemas/structured-cv";
import styles from "./designed-cv.module.css";

/**
 * The owner's CV design, rendered from a structured CV. Server component, no
 * state: what it prints is exactly what it was given. `photo` is a data URL
 * or null (no photo, no photo block — the sidebar simply starts with the
 * contact list).
 */
export function DesignedCv({ cv, language, photo }: { cv: StructuredCv; language: CvLanguage; photo: string | null }) {
  const L = CV_LABELS[language];
  return (
    <div className={styles.page} lang={language}>
      <aside className={styles.sidebar}>
        {photo && (
          <div className={styles.photoWrap}>
            {/* A data URL: next/image would only add a proxy hop for nothing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" />
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
                    {isLink(c.href) ? <a href={c.href}>{c.value}</a> : <span>{c.value}</span>}
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
          <h1 className={styles.headerName}>{cv.name}</h1>
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

/** Only an absolute URL becomes a link; anything else prints as text. */
function isLink(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:)/i.test(href);
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
          {(e.links ?? []).length > 0 && (
            <div className={styles.links}>
              {(e.links ?? []).map((l, i) => (
                <span key={l.id}>
                  {i > 0 && " · "}
                  {isLink(l.href) ? <a href={l.href}>{l.label}</a> : <span>{l.label}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ContactIcon({ kind }: { kind: CvContact["kind"] }) {
  switch (kind) {
    case "phone":
      return <span>☎</span>;
    case "email":
      return <span>@</span>;
    case "location":
      return <span>⌂</span>;
    case "github":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .5C5.649.5.5 5.73.5 12.18c0 5.148 3.292 9.515 7.866 11.07.576.11.786-.254.786-.565 0-.278-.01-1.012-.016-1.987-3.202.714-3.878-1.584-3.878-1.584-.522-1.354-1.276-1.714-1.276-1.714-1.043-.73.08-.716.08-.716 1.154.083 1.761 1.21 1.761 1.21 1.025 1.805 2.69 1.283 3.345.981.104-.76.401-1.283.73-1.578-2.56-.298-5.25-1.313-5.25-5.842 0-1.291.445-2.346 1.175-3.173-.118-.298-.51-1.498.115-3.125 0 0 .958-.313 3.14 1.212A10.58 10.58 0 0 1 12 5.76c.97.005 1.946.133 2.86.389 2.18-1.525 3.137-1.212 3.137-1.212.626 1.627.232 2.827.114 3.125.732.827 1.174 1.882 1.174 3.173 0 4.54-2.694 5.54-5.263 5.833.413.367.78 1.089.78 2.196 0 1.585-.015 2.862-.015 3.25 0 .314.206.68.79.564C20.21 21.692 23.5 17.326 23.5 12.18 23.5 5.73 18.35.5 12 .5z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 0H5C2.239 0 0 2.239 0 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5V5c0-2.761-2.238-5-5-5zM7.339 20.452H3.667V9h3.672v11.452zM5.503 7.433a2.127 2.127 0 1 1 0-4.253 2.127 2.127 0 0 1 0 4.253zM20.454 20.452h-3.666v-5.566c0-1.327-.024-3.037-1.853-3.037-1.855 0-2.14 1.45-2.14 2.94v5.663h-3.667V9h3.52v1.561h.05c.49-.927 1.685-1.903 3.468-1.903 3.709 0 4.388 2.44 4.388 5.61v6.184z" />
        </svg>
      );
    case "website":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
    default:
      return <span>·</span>;
  }
}
