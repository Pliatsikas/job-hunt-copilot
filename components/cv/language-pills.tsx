import Link from "next/link";
import { CV_LANGUAGES, type CvLanguage } from "@/lib/schemas/structured-cv";

/** ΕΛ / EN, linking to the same page in the other CV language. */
export function LanguagePills({ current, base, label }: { current: CvLanguage; base: string; label: string }) {
  return (
    <div className="inline-flex rounded-full border bg-muted/40 p-0.5" role="group" aria-label={label}>
      {CV_LANGUAGES.map((l) => (
        <Link
          key={l}
          href={`${base}${l}`}
          aria-current={l === current ? "page" : undefined}
          className={`rounded-full px-3 py-1 text-xs font-medium ${l === current ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l === "el" ? "ΕΛ" : "EN"}
        </Link>
      ))}
    </div>
  );
}
