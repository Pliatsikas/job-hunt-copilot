import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, type Locale } from "@/lib/i18n/locale";

const LABEL: Record<Locale, string> = { el: "ΕΛ", en: "EN" };

/**
 * Two buttons in a pill; the active one is filled. A form per option, no JS
 * needed. The forms are `contents` so the buttons are the pill's direct flex
 * children and fill its height — wrapped in block forms they sat short of the
 * border, and in a column parent the pill stretched to the full width.
 */
export function LanguageSwitch({ current, label }: { current: Locale; label: string }) {
  return (
    <div className="inline-flex w-fit shrink-0 items-stretch gap-0.5 rounded-full border bg-muted/40 p-0.5" role="group" aria-label={label}>
      {LOCALES.map((locale) => (
        <form key={locale} action={setLocale} className="contents">
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            aria-pressed={locale === current}
            className={`rounded-full px-2.5 py-1 text-xs font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              locale === current ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {LABEL[locale]}
          </button>
        </form>
      ))}
    </div>
  );
}
