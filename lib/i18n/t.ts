import type { Messages } from "./messages/el";

/**
 * Dotted access into the messages with `{name}` interpolation. Keys are
 * checked by the type of the messages object, not at runtime — `t("nav.today")`
 * is a typed path, so a typo fails typecheck.
 */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends Record<string, unknown>
      ? Leaves<T[K], `${P}${K}.`>
      : never;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function makeT(messages: Messages): T {
  return (key, vars) => {
    let value: unknown = messages;
    for (const part of key.split(".")) {
      value = (value as Record<string, unknown>)?.[part];
    }
    let text = typeof value === "string" ? value : key;
    if (vars) {
      for (const [name, v] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(v));
    }
    return text;
  };
}
