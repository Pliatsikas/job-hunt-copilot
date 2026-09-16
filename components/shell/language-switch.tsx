import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, type Locale } from "@/lib/i18n/locale";

const LABEL: Record<Locale, string> = { el: "ΕΛ", en: "EN" };

/** Two buttons in a pill; the active one is filled. A form per option, no JS needed. */
export function LanguageSwitch({ current, label }: { current: Locale; label: string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border bg-card" role="group" aria-label={label}>
      {LOCALES.map((locale) => (
        <form key={locale} action={setLocale}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            aria-pressed={locale === current}
            className={`px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              locale === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {LABEL[locale]}
          </button>
        </form>
      ))}
    </div>
  );
}
