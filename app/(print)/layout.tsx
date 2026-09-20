import type { ReactNode } from "react";
import { Source_Serif_4 } from "next/font/google";

// The name on the designed CV. Greek subset on purpose: the original used
// DM Serif Display, which has no Greek glyphs, and the Greek CV was
// falling back to the system serif without anyone noticing.
const cvSerif = Source_Serif_4({
  variable: "--font-cv-serif",
  subsets: ["latin", "greek"],
  weight: ["600", "700"],
  display: "swap",
});

/** No shell: this group is the document itself, for the screen and the printer. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className={`${cvSerif.variable} min-h-full`}>{children}</div>;
}
