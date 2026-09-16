import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getT, MESSAGES } from "@/lib/i18n/server";
import { LanguageSwitch } from "@/components/shell/language-switch";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getT();
  return (
    <I18nProvider locale={locale} messages={MESSAGES[locale]}>
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
        {children}
        <LanguageSwitch current={locale} label={t("nav.language")} />
      </div>
    </I18nProvider>
  );
}
