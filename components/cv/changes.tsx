import type { T } from "@/lib/i18n/t";
import type { CvChange, CvRejection } from "@/lib/cv/select";

/**
 * Every rewrite the model made, side by side with the owner's own words, and
 * every rewrite it was not allowed to make. Shown wherever a designed CV is
 * — the result card and the print page — because a CV that was changed for
 * a role must never be a surprise at the interview.
 */
export function CvChanges({ changes, rejected, t }: { changes: CvChange[]; rejected: CvRejection[]; t: T }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {changes.length === 0 ? (
        <p className="text-muted-foreground">{t("application.rephrasedNone")}</p>
      ) : (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">{t("application.rephrased", { count: changes.length })}</summary>
          <ul className="mt-3 flex flex-col gap-3">
            {changes.map((c) => (
              <li key={c.id} className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">{t("application.wasWritten")}</span>
                  <p className="text-muted-foreground">{c.from}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{t("application.nowSays")}</span>
                  <p>{c.to}</p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {rejected.length > 0 && (
        <details className="rounded-lg border border-destructive/40 p-3">
          <summary className="cursor-pointer">{t("application.rejectedRewrites", { count: rejected.length })}</summary>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {rejected.map((r) => (
              <li key={r.id}>
                <span className="line-through">{r.text}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
