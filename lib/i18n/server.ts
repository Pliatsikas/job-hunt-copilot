import { cookies, headers } from "next/headers";
import { el } from "./messages/el";
import { en } from "./messages/en";
import { isLocale, localeFromAcceptLanguage, LOCALE_COOKIE, type Locale } from "./locale";
import { makeT, type T } from "./t";

const MESSAGES = { el, en } as const;

/** The viewer's language: the cookie if set, else the browser's. Server only. */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const h = await headers();
  return localeFromAcceptLanguage(h.get("accept-language"));
}

export async function getMessages() {
  return MESSAGES[await getLocale()];
}

export async function getT(): Promise<T> {
  return makeT(await getMessages());
}

export { MESSAGES };
