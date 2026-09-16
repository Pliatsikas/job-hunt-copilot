import type { ReactNode } from "react";
import { getLocale, getT } from "@/lib/i18n/server";
import { LanguageSwitch } from "@/components/shell/language-switch";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
      {children}
      <LanguageSwitch current={locale} label={t("nav.language")} />
    </div>
  );
}
