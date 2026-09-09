import type { ScorePoint } from "@/lib/applications/insights";

const WIDTH = 640;
const HEIGHT = 180;
const PADDING = { top: 16, right: 16, bottom: 28, left: 32 };

/**
 * Server-rendered SVG line. Values are printed at each point rather than
 * hidden behind a hover, so the chart still reads on a phone and in a
 * screenshot — which is where a portfolio project is usually seen.
 */
export function ScoreTrendChart({ points }: { points: ScorePoint[] }) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  // Fixed 0-100 domain: the score is a percentage, and autoscaling would
  // make a 4-point wobble look like a collapse.
  const x = (index: number) =>
    PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (score: number) => PADDING.top + plotHeight - (score / 100) * plotHeight;

  const line = points.map((p, i) => `${x(i)},${y(p.averageScore)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label={`Average match score by month: ${points
        .map((p) => `${p.month} ${p.averageScore}`)
        .join(", ")}`}
    >
      {[0, 50, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={y(tick)}
            y2={y(tick)}
            className="stroke-border"
            strokeWidth={1}
          />
          <text
            x={PADDING.left - 6}
            y={y(tick) + 4}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {tick}
          </text>
        </g>
      ))}

      {points.length > 1 && (
        <polyline points={line} fill="none" className="stroke-primary" strokeWidth={2} />
      )}

      {points.map((point, index) => (
        <g key={point.month}>
          <circle cx={x(index)} cy={y(point.averageScore)} r={4} className="fill-primary" />
          <text
            x={x(index)}
            y={y(point.averageScore) - 10}
            textAnchor="middle"
            className="fill-foreground text-[10px] font-medium"
          >
            {point.averageScore}
          </text>
          <text
            x={x(index)}
            y={HEIGHT - 8}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {point.month}
          </text>
        </g>
      ))}
    </svg>
  );
}
