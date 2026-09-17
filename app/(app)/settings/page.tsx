import type { Metadata } from "next";
import { getAccount } from "@/lib/account/queries";
import { getT } from "@/lib/i18n/server";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { EmailForm } from "./email-form";
import { PasswordForm } from "./password-forms";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [t, account] = await Promise.all([getT(), getAccount()]);

  return (
    <Page>
      <PageHeader title={t("settings.title")} description={t("settings.sub")} />
      <div className="flex flex-col gap-6">
        <section className="rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="text-base font-semibold">{t("settings.emailTitle")}</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{account.email}</span> · {t("settings.emailSub")}
          </p>
          <EmailForm />
        </section>

        <section id="password-section" className="rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="text-base font-semibold">{t("settings.passwordTitle")}</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            {account.hasPassword ? t("settings.hasPassword") : t("settings.noPassword")}
          </p>
          <PasswordForm hasPassword={account.hasPassword} />
        </section>
      </div>
    </Page>
  );
}
