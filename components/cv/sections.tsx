"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/t";
import type { CvContact, CvEntry, StructuredCv } from "@/lib/schemas/structured-cv";
import { ChipsEditor } from "@/components/chips-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_FOCUS } from "@/components/ui/select-focus";
import { Textarea } from "@/components/ui/textarea";

const selectClass = "h-9 rounded-lg border border-border bg-background px-2.5 text-sm" + SELECT_FOCUS;
const CONTACT_KINDS: CvContact["kind"][] = ["phone", "email", "location", "github", "website", "linkedin", "other"];

let seq = 0;
/** Client-side ids for new items; the server replaces any it does not like. */
export const newId = (prefix: string) => `${prefix}-new-${Date.now().toString(36)}-${(seq += 1)}`;

export const emptyEntry = (prefix: string): CvEntry => ({ id: newId(prefix), title: "", org: "", date: "", location: "", bullets: [], links: [] });

/** What every section edits: the CV and a setter for one key of it. */
export type SectionProps = {
  cv: StructuredCv;
  set: <K extends keyof StructuredCv>(key: K, value: StructuredCv[K]) => void;
  /** The wizard adds its own heading and guidance; the editor shows the card title. */
  bare?: boolean;
};

/*
 * The CV's sections as components, so the full editor (every section, one
 * save button) and the guided wizard (one section per step) are the same
 * form fields with different chrome.
 */
export function IdentityFields({ cv, set, bare }: SectionProps) {
  const t = useT();
  return (
    <Section title={t("cvEditor.identity")} bare={bare}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("cvEditor.name")} id="cv-name">
          <Input id="cv-name" value={cv.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label={t("cvEditor.subtitle")} id="cv-subtitle">
          <Input id="cv-subtitle" value={cv.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder={t("cvEditor.subtitlePlaceholder")} />
        </Field>
      </div>
      <Field label={t("cvEditor.about")} id="cv-about">
        <Textarea id="cv-about" rows={4} value={cv.about} onChange={(e) => set("about", e.target.value)} placeholder={t("cvEditor.aboutPlaceholder")} />
      </Field>
    </Section>
  );
}

export function ContactsFields({ cv, set, bare }: SectionProps) {
  const t = useT();
  return (
    <Section title={t("cvEditor.contacts")} bare={bare}>
      <RowList
        items={cv.contacts}
        onChange={(v) => set("contacts", v)}
        create={(): CvContact => ({ id: newId("contact"), kind: "other", value: "", href: "" })}
        render={(c, update) => (
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[9rem_1fr_1fr]">
            <select aria-label={t("cvEditor.contactKind")} className={selectClass} value={c.kind} onChange={(e) => update({ ...c, kind: e.target.value as CvContact["kind"] })}>
              {CONTACT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`cvEditor.kinds.${k}` as MessageKey)}
                </option>
              ))}
            </select>
            <Input aria-label={t("cvEditor.contactValue")} value={c.value} onChange={(e) => update({ ...c, value: e.target.value })} placeholder={t("cvEditor.contactValue")} />
            <Input aria-label={t("cvEditor.contactHref")} value={c.href ?? ""} onChange={(e) => update({ ...c, href: e.target.value })} placeholder={t("cvEditor.contactHref")} />
          </div>
        )}
      />
    </Section>
  );
}

export function SkillsFields({ cv, set, bare }: SectionProps) {
  const t = useT();
  return (
    <Section title={t("cvEditor.skills")} hint={t("cvEditor.skillsNote")} bare={bare}>
      <RowList
        items={cv.skillGroups}
        onChange={(v) => set("skillGroups", v)}
        addLabel={t("cvEditor.addGroup")}
        create={() => ({ id: newId("skills"), label: "", skills: [] })}
        render={(g, update) => (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input aria-label={t("cvEditor.groupLabel")} value={g.label} onChange={(e) => update({ ...g, label: e.target.value })} placeholder={t("cvEditor.groupLabel")} className="max-w-xs" />
            <ChipsEditor
              id={`skills-${g.id}`}
              name={`skills-${g.id}`}
              value={g.skills.map((s) => s.name)}
              onChange={(names) =>
                update({
                  ...g,
                  skills: names.map((name) => g.skills.find((s) => s.name === name) ?? { id: newId(`${g.id}-s`), name }),
                })
              }
              placeholder={t("profile.skillPlaceholder")}
              max={30}
              keepCase
            />
          </div>
        )}
      />
    </Section>
  );
}

export function LanguagesFields({ cv, set, bare }: SectionProps) {
  const t = useT();
  return (
    <Section title={t("cvEditor.languages")} bare={bare}>
      <RowList
        items={cv.languages}
        onChange={(v) => set("languages", v)}
        create={() => ({ id: newId("lang"), name: "", level: "" })}
        render={(l, update) => (
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            <Input aria-label={t("cvEditor.langName")} value={l.name} onChange={(e) => update({ ...l, name: e.target.value })} placeholder={t("cvEditor.langName")} />
            <Input aria-label={t("cvEditor.langLevel")} value={l.level} onChange={(e) => update({ ...l, level: e.target.value })} placeholder={t("cvEditor.langLevel")} />
          </div>
        )}
      />
    </Section>
  );
}

export function CertificationsFields({ cv, set, bare }: SectionProps) {
  const t = useT();
  return (
    <Section title={t("cvEditor.certifications")} bare={bare}>
      <RowList
        items={cv.certifications}
        onChange={(v) => set("certifications", v)}
        create={() => ({ id: newId("cert"), name: "", issuer: "", year: "" })}
        render={(c, update) => (
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[2fr_1fr_5rem]">
            <Input aria-label={t("cvEditor.certName")} value={c.name} onChange={(e) => update({ ...c, name: e.target.value })} placeholder={t("cvEditor.certName")} />
            <Input aria-label={t("cvEditor.certIssuer")} value={c.issuer} onChange={(e) => update({ ...c, issuer: e.target.value })} placeholder={t("cvEditor.certIssuer")} />
            <Input aria-label={t("cvEditor.certYear")} value={c.year} onChange={(e) => update({ ...c, year: e.target.value })} placeholder={t("cvEditor.certYear")} />
          </div>
        )}
      />
    </Section>
  );
}

export function InterestsFields({ cv, set, bare }: SectionProps) {
  const t = useT();
  return (
    <Section title={t("cvEditor.interests")} bare={bare}>
      <ChipsEditor
        id="cv-interests"
        name="cv-interests"
        value={cv.interests.map((i) => i.name)}
        onChange={(names) => set("interests", names.map((name) => cv.interests.find((i) => i.name === name) ?? { id: newId("interest"), name }))}
        placeholder={t("cvEditor.add")}
        max={12}
        keepCase
      />
    </Section>
  );
}

export function ExperienceFields({ cv, set, bare }: SectionProps) {
  const t = useT();
  return <EntrySection title={t("cvEditor.experience")} prefix="exp" items={cv.experience} onChange={(v) => set("experience", v)} bare={bare} />;
}
export function EducationFields({ cv, set, bare }: SectionProps) {
  const t = useT();
  return <EntrySection title={t("cvEditor.education")} prefix="edu" items={cv.education} onChange={(v) => set("education", v)} bare={bare} />;
}
export function ProjectsFields({ cv, set, bare }: SectionProps) {
  const t = useT();
  return <EntrySection title={t("cvEditor.projects")} prefix="proj" items={cv.projects} onChange={(v) => set("projects", v)} withLinks bare={bare} />;
}

function Section({ title, hint, bare, children }: { title: string; hint?: string; bare?: boolean; children: ReactNode }) {
  if (bare) return <div className="flex flex-col gap-4">{children}</div>;
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** A list with add / remove / up / down — the same chrome for every kind of row. */
function RowList<T extends { id: string }>({
  items,
  onChange,
  create,
  render,
  addLabel,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  create: () => T;
  render: (item: T, update: (next: T) => void) => ReactNode;
  addLabel?: string;
}) {
  const t = useT();
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={item.id} className="flex min-w-0 items-start gap-2">
          {render(item, (next) => onChange(items.map((x) => (x.id === item.id ? next : x))))}
          <div className="flex shrink-0 items-center gap-0.5">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("cvEditor.up")} onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("cvEditor.down")} onClick={() => move(i, 1)} disabled={i === items.length - 1}>
              <ArrowDown aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("cvEditor.remove")} onClick={() => onChange(items.filter((x) => x.id !== item.id))}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, create()])}>
          <Plus aria-hidden />
          {addLabel ?? t("cvEditor.add")}
        </Button>
      </div>
    </div>
  );
}

function EntrySection({
  title,
  prefix,
  items,
  onChange,
  withLinks = false,
  bare,
}: {
  title: string;
  prefix: string;
  items: CvEntry[];
  onChange: (next: CvEntry[]) => void;
  withLinks?: boolean;
  bare?: boolean;
}) {
  const t = useT();
  return (
    <Section title={title} bare={bare}>
      <RowList
        items={items}
        onChange={onChange}
        create={() => emptyEntry(prefix)}
        render={(e, update) => (
          <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input aria-label={t("cvEditor.entryTitle")} value={e.title} onChange={(ev) => update({ ...e, title: ev.target.value })} placeholder={t("cvEditor.entryTitle")} />
              <Input aria-label={t("cvEditor.entryOrg")} value={e.org} onChange={(ev) => update({ ...e, org: ev.target.value })} placeholder={t("cvEditor.entryOrg")} />
              <Input aria-label={t("cvEditor.entryDate")} value={e.date} onChange={(ev) => update({ ...e, date: ev.target.value })} placeholder={t("cvEditor.entryDate")} />
              <Input aria-label={t("cvEditor.entryLocation")} value={e.location} onChange={(ev) => update({ ...e, location: ev.target.value })} placeholder={t("cvEditor.entryLocation")} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t("cvEditor.bullets")}</span>
              <RowList
                items={e.bullets}
                onChange={(bullets) => update({ ...e, bullets })}
                addLabel={t("cvEditor.addBullet")}
                create={() => ({ id: newId(`${e.id}-b`), text: "" })}
                render={(b, ub) => (
                  <Textarea aria-label={t("cvEditor.bullets")} rows={2} value={b.text} onChange={(ev) => ub({ ...b, text: ev.target.value })} placeholder={t("cvEditor.bulletPlaceholder")} className="min-w-0 flex-1" />
                )}
              />
            </div>
            {withLinks && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t("cvEditor.links")}</span>
                <RowList
                  items={e.links ?? []}
                  onChange={(links) => update({ ...e, links })}
                  addLabel={t("cvEditor.addLink")}
                  create={() => ({ id: newId(`${e.id}-l`), label: "", href: "" })}
                  render={(l, ul) => (
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                      <Input aria-label={t("cvEditor.linkLabel")} value={l.label} onChange={(ev) => ul({ ...l, label: ev.target.value })} placeholder={t("cvEditor.linkLabel")} />
                      <Input aria-label={t("cvEditor.linkHref")} value={l.href} onChange={(ev) => ul({ ...l, href: ev.target.value })} placeholder="https://" />
                    </div>
                  )}
                />
              </div>
            )}
          </div>
        )}
      />
    </Section>
  );
}
