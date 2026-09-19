"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { extractStructuredCv, saveStructuredCv, type CvSaveState, type ExtractState } from "@/lib/cv/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/t";
import { type CvContact, type CvEntry, type CvLanguage, type StructuredCv } from "@/lib/schemas/structured-cv";
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
const newId = (prefix: string) => `${prefix}-new-${Date.now().toString(36)}-${(seq += 1)}`;

const emptyEntry = (prefix: string): CvEntry => ({ id: newId(prefix), title: "", org: "", date: "", location: "", bullets: [], links: [] });

/**
 * The whole CV lives in one state object; every section edits a slice of
 * it; the form posts it as one JSON field. Nothing is saved until the save
 * button — including the model's extraction, which only fills the state.
 */
export function CvEditor({
  initial,
  language,
  hasCvText,
  onChange,
  designJson,
}: {
  initial: StructuredCv;
  language: CvLanguage;
  hasCvText: boolean;
  /** The builder listens here to render the live preview. */
  onChange?: (cv: StructuredCv) => void;
  /** The builder's design choices, saved together with the CV. */
  designJson?: string;
}) {
  const t = useT();
  const [cv, setCv] = useState<StructuredCv>(initial);
  const [saveState, save, saving] = useActionState<CvSaveState, FormData>(saveStructuredCv, {});
  const [extract, extractAction, extracting] = useActionState<ExtractState, FormData>(extractStructuredCv, {});

  useEffect(() => {
    if (extract.cv) setCv(extract.cv);
  }, [extract.cv]);
  useEffect(() => {
    onChange?.(cv);
  }, [cv, onChange]);

  const set = <K extends keyof StructuredCv>(key: K, value: StructuredCv[K]) => setCv((c) => ({ ...c, [key]: value }));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-sm text-muted-foreground">{t("cvEditor.fillNote")}</p>
          <form action={extractAction}>
            <Button type="submit" variant="secondary" pending={extracting} disabled={!hasCvText}>
              {!extracting && <Sparkles className="size-4" aria-hidden />}
              {extracting ? t("cvEditor.filling") : t("cvEditor.fillFromText")}
            </Button>
          </form>
        </div>
        {extract.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {extract.error}
          </p>
        )}
        {extract.cv && (
          <div role="status" className="mt-3 rounded-lg border bg-accent/40 p-3 text-sm animate-in fade-in duration-300">
            <p>{t("cvEditor.filled")}</p>
            {extract.dropped && extract.dropped.length > 0 && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">{t("cvEditor.droppedIntro", { count: extract.dropped.length })}</summary>
                <ul className="mt-1 list-disc pl-5">
                  {extract.dropped.slice(0, 40).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <form action={save} className="flex flex-col gap-6">
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="cv" value={JSON.stringify(cv)} />
        {designJson && <input type="hidden" name="design" value={designJson} />}

        <Section title={t("cvEditor.identity")}>
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

        <Section title={t("cvEditor.contacts")}>
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

        <Section title={t("cvEditor.skills")} hint={t("cvEditor.skillsNote")}>
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

        <Section title={t("cvEditor.languages")}>
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

        <Section title={t("cvEditor.certifications")}>
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

        <Section title={t("cvEditor.interests")}>
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

        <EntrySection title={t("cvEditor.experience")} prefix="exp" items={cv.experience} onChange={(v) => set("experience", v)} />
        <EntrySection title={t("cvEditor.education")} prefix="edu" items={cv.education} onChange={(v) => set("education", v)} />
        <EntrySection title={t("cvEditor.projects")} prefix="proj" items={cv.projects} onChange={(v) => set("projects", v)} withLinks />

        {saveState.error && (
          <p role="alert" className="text-sm text-destructive">
            {saveState.error}
          </p>
        )}
        {saveState.savedAt && !saveState.error && (
          <p role="status" className="text-sm text-muted-foreground animate-in fade-in duration-300">
            {t("cvEditor.saved")}
          </p>
        )}
        <div className="sticky bottom-16 z-10 -mx-4 flex justify-end border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:bottom-0 lg:-mx-8 lg:px-8">
          <Button type="submit" pending={saving} size="lg">
            {t("cvEditor.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
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
}: {
  title: string;
  prefix: string;
  items: CvEntry[];
  onChange: (next: CvEntry[]) => void;
  withLinks?: boolean;
}) {
  const t = useT();
  return (
    <Section title={title}>
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
