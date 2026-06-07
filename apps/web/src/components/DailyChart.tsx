import type { DailyTestStatus } from "@la-fontaine/shared";
import { BY_HEART_THRESHOLD } from "@la-fontaine/shared";

// Server stores dates as UTC YYYY-MM-DD (toISOString slice), so mark "today" the same way.
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return day && month ? `${day}/${month}` : iso;
}

export function DailyChart({ status }: { status: DailyTestStatus }) {
  const points = status.history;
  if (points.length === 0) {
    return null;
  }

  const W = 320;
  const H = 152;
  const left = 24;
  const right = 16;
  const top = 16;
  const bottom = 30;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const n = points.length;
  const today = todayKey();

  const x = (i: number) => left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const y = (score: number) => top + (1 - Math.max(0, Math.min(100, score)) / 100) * plotH;

  const linePoints = points.map((point, i) => `${x(i).toFixed(1)},${y(point.score).toFixed(1)}`).join(" ");
  const thresholdY = y(BY_HEART_THRESHOLD);
  const todayIndex = points.findIndex((point) => point.date === today);

  // Keep the x-axis legible: when there are many tests, only label the ends, today, and a few in between.
  const labelEvery = n <= 8 ? 1 : Math.ceil(n / 6);
  const showLabel = (i: number) =>
    i === 0 || i === n - 1 || points[i]!.date === today || i % labelEvery === 0;
  // Edge-aware anchoring so the first/last date labels never clip past the chart.
  const anchorFor = (i: number): "start" | "middle" | "end" =>
    i === 0 ? "start" : i === n - 1 ? "end" : "middle";

  return (
    <svg
      className="daily-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Courbe de mémorisation sur ${n} test${n > 1 ? "s" : ""}. Meilleur score ${status.best}%.`}
    >
      {[0, 50, 100].map((tick) => (
        <g key={tick}>
          <line className="daily-chart__grid" x1={left} y1={y(tick)} x2={W - right} y2={y(tick)} />
          <text className="daily-chart__ylabel" x={left - 6} y={y(tick) + 3} textAnchor="end">
            {tick}
          </text>
        </g>
      ))}

      <line className="daily-chart__threshold" x1={left} y1={thresholdY} x2={W - right} y2={thresholdY} />
      <text className="daily-chart__threshold-label" x={left + 3} y={thresholdY - 4} textAnchor="start">
        par cœur · {BY_HEART_THRESHOLD}%
      </text>
      {todayIndex >= 0 ? (
        <text className="daily-chart__today-callout" x={W - right} y={top - 5} textAnchor="end">
          aujourd’hui
        </text>
      ) : null}

      {n > 1 ? (
        <polyline
          className="daily-chart__line"
          points={linePoints}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {points.map((point, i) => {
        const isToday = point.date === today;
        const mastered = point.score >= BY_HEART_THRESHOLD;
        return (
          <g key={point.date}>
            {isToday ? (
              <line className="daily-chart__today-guide" x1={x(i)} y1={y(point.score)} x2={x(i)} y2={H - bottom} />
            ) : null}
            {isToday ? <circle className="daily-chart__today-ring" cx={x(i)} cy={y(point.score)} r={7} /> : null}
            <circle
              className={`daily-chart__dot${mastered ? " daily-chart__dot--mastered" : ""}`}
              cx={x(i)}
              cy={y(point.score)}
              r={isToday ? 4 : 3.2}
            >
              <title>{`${formatDay(point.date)} : ${point.score}%`}</title>
            </circle>
            {showLabel(i) ? (
              <text
                className={`daily-chart__xlabel${isToday ? " daily-chart__xlabel--today" : ""}`}
                x={x(i)}
                y={H - bottom + 16}
                textAnchor={anchorFor(i)}
              >
                {formatDay(point.date)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
