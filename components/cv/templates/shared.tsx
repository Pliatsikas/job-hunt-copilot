import type { CvDesign } from "@/lib/schemas/cv-design";
import { CV_ACCENTS } from "@/lib/schemas/cv-design";
import type { CvContact, CvEntry, CvLanguage, StructuredCv } from "@/lib/schemas/structured-cv";

/**
 * What every template receives, and nothing else — so the builder's live
 * preview, the owner's own CV page and the tailored-CV page render the same
 * component with the same inputs. `photo` is a data URL or null; a template
 * that has no place for a photo ignores it.
 */
export type TemplateProps = {
  cv: StructuredCv;
  language: CvLanguage;
  photo: string | null;
  design: CvDesign;
  /**
   * On the print pages the name is the document's h1. Inside the builder the
   * page already has one, so the preview's name is a plain block — same
   * look, and the page keeps a single h1 (the layout E2E checks it).
   */
  embedded?: boolean;
};

/** The candidate's name: h1 on its own page, a div when embedded in another. */
export function Name({ embedded, className, children }: { embedded?: boolean; className: string; children: React.ReactNode }) {
  return embedded ? <div className={className}>{children}</div> : <h1 className={className}>{children}</h1>;
}

/** The accent as a CSS custom property the template's stylesheet reads. */
export function accentStyle(design: CvDesign): React.CSSProperties {
  return { ["--cv-accent" as string]: CV_ACCENTS[design.accent] };
}

/** Only an absolute URL becomes a link; anything else prints as text. */
export function isLink(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:)/i.test(href);
}

export function EntryLinks({ entry, className }: { entry: CvEntry; className?: string }) {
  const links = entry.links ?? [];
  if (!links.length) return null;
  return (
    <div className={className}>
      {links.map((l, i) => (
        <span key={l.id}>
          {i > 0 && " · "}
          {isLink(l.href) ? <a href={l.href}>{l.label}</a> : <span>{l.label}</span>}
        </span>
      ))}
    </div>
  );
}

export function ContactIcon({ kind }: { kind: CvContact["kind"] }) {
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

/** The contact value, linked when it carries a real href. */
export function ContactValue({ contact }: { contact: CvContact }) {
  return isLink(contact.href) ? <a href={contact.href}>{contact.value}</a> : <span>{contact.value}</span>;
}
