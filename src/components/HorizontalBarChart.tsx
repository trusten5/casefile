const CHART_HEIGHT_PER_ROW = 28;
const CHART_ROW_GAP = 8;
const LABEL_WIDTH = 160;
const CHART_WIDTH = 480;

export type BarRow = { id: string; label: string; value: number; tooltip: string };

// Hand-rolled SVG labeled-bar chart — no charting library in this app (see
// TopCompanies.tsx, ApplicationSankey.tsx). Extracted here once both of
// those needed the identical shape rather than a third copy-paste.
export function HorizontalBarChart({
  rows,
  color,
  ariaLabel,
}: {
  rows: BarRow[];
  color: string;
  ariaLabel: string;
}) {
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.value));
  const rowHeight = CHART_HEIGHT_PER_ROW + CHART_ROW_GAP;
  const chartHeight = rows.length * rowHeight;

  return (
    <svg
      viewBox={`0 0 ${LABEL_WIDTH + CHART_WIDTH + 48} ${chartHeight}`}
      role="img"
      aria-label={`${ariaLabel}: ${rows.map((r) => `${r.label}, ${r.value}`).join("; ")}`}
      className="w-full"
    >
      {rows.map((r, i) => {
        const y = i * rowHeight;
        const barWidth = Math.max(4, (r.value / max) * CHART_WIDTH);
        return (
          <g key={r.id}>
            <text
              x={LABEL_WIDTH}
              y={y + CHART_HEIGHT_PER_ROW / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink font-sans text-[13px]"
            >
              {r.label}
            </text>
            <rect
              x={LABEL_WIDTH + 12}
              y={y + 2}
              width={barWidth}
              height={CHART_HEIGHT_PER_ROW - 4}
              rx={4}
              fill={color}
            >
              <title>{r.tooltip}</title>
            </rect>
            <text
              x={LABEL_WIDTH + 12 + barWidth + 8}
              y={y + CHART_HEIGHT_PER_ROW / 2}
              dominantBaseline="middle"
              className="fill-ink-soft font-mono text-[11px]"
            >
              {r.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
