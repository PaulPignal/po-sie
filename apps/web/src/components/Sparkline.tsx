import type { DailyTestPoint } from "@la-fontaine/shared";

export function Sparkline({ points }: { points: DailyTestPoint[] }) {
  if (points.length === 0) {
    return null;
  }

  const width = 100;
  const height = 34;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    x: points.length > 1 ? index * step : width / 2,
    y: height - (Math.max(0, Math.min(100, point.score)) / 100) * height
  }));
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1]!;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Évolution de ta mémorisation jour après jour"
    >
      {points.length > 1 ? (
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      ) : null}
      <circle cx={last.x} cy={last.y} r={2.5} fill="currentColor" />
    </svg>
  );
}
