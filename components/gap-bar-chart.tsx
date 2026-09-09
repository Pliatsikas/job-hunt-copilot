import type { MissingSkill } from "@/lib/applications/insights";
import type { Severity } from "@/lib/schemas/analysis";

// Severity is also written on each row, so colour is reinforcement rather than
// the only carrier of meaning.
const SEVERITY_STYLE: Record<Severity, { bar: string; label: string }> = {
  blocker: { bar: "bg-destructive", label: "Blocker" },
  important: { bar: "bg-primary", label: "Important" },
  nice_to_have: { bar: "bg-muted-foreground/40", label: "Nice to have" },
};

/**
 * Horizontal bars, server-rendered. A ranked list of counts needs a length and
 * a number next to it; nothing here benefits from a charting runtime.
 */
export function GapBarChart({ skills }: { skills: MissingSkill[] }) {
  const max = Math.max(...skills.map((s) => s.count), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(Object.keys(SEVERITY_STYLE) as Severity[]).map((severity) => (
          <span key={severity} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${SEVERITY_STYLE[severity].bar}`} />
            {SEVERITY_STYLE[severity].label}
          </span>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {skills.map((entry) => (
          <li key={`${entry.skill}-${entry.severity}`} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm" title={entry.skill}>
              {entry.skill}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
              <div
                className={`h-full rounded ${SEVERITY_STYLE[entry.severity].bar}`}
                style={{ width: `${Math.max((entry.count / max) * 100, 4)}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-sm tabular-nums">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
