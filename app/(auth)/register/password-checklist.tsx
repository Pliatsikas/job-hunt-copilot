"use client";

import { Check, Circle } from "lucide-react";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES } from "@/lib/password-rules";
import { useT } from "@/lib/i18n/client";

/**
 * Renders the same rules the server enforces, as the user types. A checklist
 * rather than a strength meter: a meter implies a score nobody can explain,
 * a checklist says exactly what is still missing. `aria-live="polite"` lets a
 * screen reader hear items flip without interrupting typing, and each item
 * carries its state in text so colour and icon are never the only signal.
 */
export function PasswordChecklist({ password }: { password: string }) {
  const t = useT();
  return (
    <ul aria-live="polite" className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 ${met ? "text-score-high" : "text-muted-foreground"}`}
          >
            {met ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <Circle className="size-3.5 shrink-0" aria-hidden />
            )}
            <span>{t(`auth.rules.${rule.id}`, { min: PASSWORD_MIN_LENGTH })}</span>
            <span className="sr-only">{met ? ` ${t("auth.met")}` : ` ${t("auth.notYet")}`}</span>
          </li>
        );
      })}
    </ul>
  );
}
