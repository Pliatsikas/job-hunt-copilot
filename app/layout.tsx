import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
