import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";

// Inter, not Geist: the CVs and the postings are partly Greek, and Geist has
// no Greek glyphs — every Greek line was silently falling back to the system
// font. Inter covers both scripts in one face, so a Greek ad and an English
// analysis sit on the same page without a visible seam.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin", "greek"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "greek"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://job-hunt-copilot-gamma.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Pages set their own title; this frames it. A page that forgets still gets
  // the product name rather than "Create Next App".
  title: {
    default: "Job Hunt Copilot",
    template: "%s · Job Hunt Copilot",
  },
  description:
    "Paste a job ad and see how it matches your CV: an evidence-backed score, the gaps worth preparing for, and a cover letter grounded in what you have actually done.",
  applicationName: "Job Hunt Copilot",
  openGraph: {
    type: "website",
    siteName: "Job Hunt Copilot",
    title: "Job Hunt Copilot",
    description:
      "An evidence-backed match score against your own CV, the gaps worth preparing for, and letters that don't invent experience.",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
