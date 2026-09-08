// Dates are stored UTC. The product's UI language is English (SPEC.md), so
// these render in a fixed, unambiguous English format rather than the server's
// locale — a Server Component can't see the viewer's locale, and formatting
// per-viewer would need a client component. See NOTES.md.
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDate(value: Date | null | undefined) {
  return value ? DATE.format(value) : null;
}

export function formatDateTime(value: Date) {
  return DATE_TIME.format(value);
}

/** For <input type="date">, which requires exactly YYYY-MM-DD. */
export function toDateInputValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}
