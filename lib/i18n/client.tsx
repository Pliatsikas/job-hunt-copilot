"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./locale";
import type { Messages } from "./messages/el";
import { makeT, type T } from "./t";

const Ctx = createContext<{ locale: Locale; t: T } | null>(null);

/** Seeded once from the server layout; every client component reads from it. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  return <Ctx.Provider value={{ locale, t: makeT(messages) }}>{children}</Ctx.Provider>;
}

export function useT(): T {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useT() needs an I18nProvider above it");
  return ctx.t;
}

export function useLocale(): Locale {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLocale() needs an I18nProvider above it");
  return ctx.locale;
}
