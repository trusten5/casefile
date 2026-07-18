import { STATUSES, PIPELINE, type ApplicationFlow } from "@/lib/applications";

// Applied/OA/Interview are a *funnel* (ordinal — position in a sequence, not
// identity), so they read as one hue stepping darker with progress. Offer/
// Rejected/Ghosted are outcomes, not "more stages" — they use status colors
// (good/critical/warning), each paired with an icon since red/green alone
// isn't distinguishable under deuteranopia (validated: ΔE 4.1, hence the
// icon). Hex values are hardcoded, not the CSS custom properties in
// globals.css — SVG fill doesn't reliably resolve those, and this ramp/status
// set was chosen and validated (scripts/validate_palette.js) specifically
// for this chart, distinct from the app-wide status pill colors.
const NODE_COLOR: Record<string, string> = {
  applied: "#6B83B3",
  oa: "#44608F",
  interview: "#2B3A55",
  offer: "#0CA30C",
  rejected: "#D03B3B",
  ghosted: "#C98A2C",
};
const NODE_ICON: Record<string, string> = { offer: "✓", rejected: "✕", ghosted: "…" };
const NODE_LABEL: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

// applied/oa/interview each get their own column; offer/rejected/ghosted are
// the three "final" outcomes and share one column, stacked vertically.
const PIPELINE_COLUMNS: string[] = PIPELINE.slice(0, -1); // applied, oa, interview
const TERMINALS = ["offer", "rejected", "ghosted"];
const NODE_ORDER = [...PIPELINE_COLUMNS, ...TERMINALS]; // stable sort order for stacking segments

const COLUMN_X = [70, 210, 350, 490];
const NODE_X: Record<string, number> = {
  applied: COLUMN_X[0],
  oa: COLUMN_X[1],
  interview: COLUMN_X[2],
  offer: COLUMN_X[3],
  rejected: COLUMN_X[3],
  ghosted: COLUMN_X[3],
};
// Column *slot*, not x pixel — used to tell "adjacent" (safe for a plain
// ribbon) from "skips over a column" (needs to arc above it instead of
// visually cutting through it).
const COLUMN_SLOT: Record<string, number> = { applied: 0, oa: 1, interview: 2, offer: 3, rejected: 3, ghosted: 3 };

const NODE_WIDTH = 14;
const BASE_UNIT = 14; // px per application, at normal scale
const MIN_SEGMENT_PX = 6; // smallest a nonzero segment is allowed to render
const HEADER_SPACE = 20;
const ARC_LANE = 40; // reserved space above the bars for skip-edges to arc through
// Wide enough that one bar's count label (below it) never collides with the
// next stacked bar's name label (above it) — the two sit ~22px apart before
// any gap at all, so this needs to clear that plus comfortable text spacing.
const TERMINAL_GAP = 40;
const TOP_MARGIN = 10;
const NODE_RADIUS = 3;

function ribbon(x0: number, x1: number, y0Top: number, y0Bottom: number, y1Top: number, y1Bottom: number) {
  const xm = (x0 + x1) / 2;
  return `M${x0},${y0Top} C${xm},${y0Top} ${xm},${y1Top} ${x1},${y1Top} L${x1},${y1Bottom} C${xm},${y1Bottom} ${xm},${y0Bottom} ${x0},${y0Bottom} Z`;
}

// Same shape as ribbon(), but bows up through an elevated apex instead of a
// straight flowing curve — used when the edge skips over a column that has
// its own bar in between, so the band goes over it instead of through it.
function arcRibbon(
  x0: number,
  x1: number,
  y0Top: number,
  y0Bottom: number,
  y1Top: number,
  y1Bottom: number,
  apexY: number
) {
  const mid1 = x0 + (x1 - x0) * 0.35;
  const mid2 = x0 + (x1 - x0) * 0.65;
  const midX = (x0 + x1) / 2;
  const apexThickness = Math.max(2, ((y0Bottom - y0Top) + (y1Bottom - y1Top)) / 2);
  const apexTop = apexY;
  const apexBottom = apexY + apexThickness;
  return [
    `M${x0},${y0Top}`,
    `C${mid1},${y0Top} ${mid1},${apexTop} ${midX},${apexTop}`,
    `C${mid2},${apexTop} ${mid2},${y1Top} ${x1},${y1Top}`,
    `L${x1},${y1Bottom}`,
    `C${mid2},${y1Bottom} ${mid2},${apexBottom} ${midX},${apexBottom}`,
    `C${mid1},${apexBottom} ${mid1},${y0Bottom} ${x0},${y0Bottom}`,
    "Z",
  ].join(" ");
}

// Renders the literal transition graph from getApplicationFlow — real
// observed edges only, no assumption that reaching a later stage implies
// passing through every earlier one. Each node's bar is stacked twice
// independently: on the left by what fed into it (a fresh start, or an
// incoming edge from an earlier node), and on the right by what left it (an
// outgoing edge, or "still resting here"). The two stackings don't have to
// line up segment-for-segment — that's normal for a Sankey; the node is a
// mixing point, not a pass-through.
export function ApplicationSankey({ flow }: { flow: ApplicationFlow }) {
  const { entryCount, exitCount, edges } = flow;

  const nodeTotal: Record<string, number> = {};
  for (const n of NODE_ORDER) nodeTotal[n] = entryCount[n] ?? 0;
  for (const e of edges) nodeTotal[e.to] = (nodeTotal[e.to] ?? 0) + e.count;

  const grandTotal = NODE_ORDER.reduce((sum, n) => sum + (entryCount[n] ?? 0), 0);
  if (grandTotal === 0) return null;

  const activePipeline = PIPELINE_COLUMNS.filter((n) => nodeTotal[n] > 0);
  const activeTerminals = TERMINALS.filter((n) => nodeTotal[n] > 0);
  const activeNodes = [...activePipeline, ...activeTerminals];

  const allQuantities = [
    ...activeNodes.map((n) => entryCount[n] ?? 0),
    ...activeNodes.map((n) => exitCount[n] ?? 0),
    ...edges.map((e) => e.count),
  ].filter((q) => q > 0);
  const minQuantity = allQuantities.length ? Math.min(...allQuantities) : 1;
  const unit = Math.max(BASE_UNIT, MIN_SEGMENT_PX / minQuantity);

  const barTop = TOP_MARGIN + HEADER_SPACE + ARC_LANE;

  // Pipeline columns all start at the same top; the three terminal bars
  // stack below one another (with a gap) at their shared x instead.
  const nodeTop: Record<string, number> = {};
  for (const n of activePipeline) nodeTop[n] = barTop;
  let terminalCursor = barTop;
  for (const n of activeTerminals) {
    nodeTop[n] = terminalCursor;
    terminalCursor += nodeTotal[n] * unit + TERMINAL_GAP;
  }

  // Two nodes sharing a column (any pair of offer/rejected/ghosted) can't be
  // connected by a ribbon — there's no horizontal distance to draw one
  // through. Real but rare (e.g. an offer later marked rejected); it still
  // counts correctly in both bars, it just doesn't get a drawn connector.
  const drawableEdges = edges.filter((e) => NODE_X[e.from] !== NODE_X[e.to]);
  const needsArc = (e: { from: string; to: string }) => COLUMN_SLOT[e.to] - COLUMN_SLOT[e.from] > 1;
  const arcEdgeKeys = drawableEdges.filter(needsArc).map((e) => `edge-${e.from}-${e.to}`);

  // Left stack per node: a fresh-start chunk (if any), then edges that arc
  // in from a skipped column (so the arc lands with nothing stacked above
  // it to duck under), then normal adjacent edges ordered by source.
  type IncomingSeg = { key: string; count: number; from?: string; arced?: boolean };
  const incomingByNode = new Map<string, IncomingSeg[]>();
  for (const n of activeNodes) incomingByNode.set(n, []);
  for (const n of activeNodes) {
    if ((entryCount[n] ?? 0) > 0) incomingByNode.get(n)!.push({ key: `entry-${n}`, count: entryCount[n] });
  }
  for (const e of drawableEdges) {
    incomingByNode
      .get(e.to)
      ?.push({ key: `edge-${e.from}-${e.to}`, count: e.count, from: e.from, arced: needsArc(e) });
  }
  const incomingRange = new Map<string, { top: number; bottom: number }>();
  for (const n of activeNodes) {
    const segs = incomingByNode.get(n)!;
    segs.sort((a, b) => {
      if (!a.from) return -1;
      if (!b.from) return 1;
      if (a.arced !== b.arced) return a.arced ? -1 : 1;
      return NODE_ORDER.indexOf(a.from) - NODE_ORDER.indexOf(b.from);
    });
    let cursor = nodeTop[n];
    for (const seg of segs) {
      const top = cursor;
      cursor += seg.count * unit;
      incomingRange.set(seg.key, { top, bottom: cursor });
    }
  }

  // Right stack per node: edges that arc out to a distant column first (so
  // they start clear of everything else in this bar and can rise straight
  // into the arc lane), then normal adjacent edges by destination, then a
  // "still resting here" chunk (if any) last.
  type OutgoingSeg = { key: string; count: number; to?: string; arced?: boolean };
  const outgoingByNode = new Map<string, OutgoingSeg[]>();
  for (const n of activeNodes) outgoingByNode.set(n, []);
  for (const e of drawableEdges) {
    outgoingByNode
      .get(e.from)
      ?.push({ key: `edge-${e.from}-${e.to}`, count: e.count, to: e.to, arced: needsArc(e) });
  }
  for (const n of activeNodes) {
    if ((exitCount[n] ?? 0) > 0) outgoingByNode.get(n)!.push({ key: `exit-${n}`, count: exitCount[n] });
  }
  const outgoingRange = new Map<string, { top: number; bottom: number }>();
  for (const n of activeNodes) {
    const segs = outgoingByNode.get(n)!;
    segs.sort((a, b) => {
      if (!a.to) return 1;
      if (!b.to) return -1;
      if (a.arced !== b.arced) return a.arced ? -1 : 1;
      return NODE_ORDER.indexOf(a.to) - NODE_ORDER.indexOf(b.to);
    });
    let cursor = nodeTop[n];
    for (const seg of segs) {
      const top = cursor;
      cursor += seg.count * unit;
      outgoingRange.set(seg.key, { top, bottom: cursor });
    }
  }

  const ribbons = drawableEdges.map((e) => {
    const key = `edge-${e.from}-${e.to}`;
    const src = outgoingRange.get(key)!;
    const dst = incomingRange.get(key)!;
    const arcIndex = arcEdgeKeys.indexOf(key);
    const d =
      arcIndex === -1
        ? ribbon(NODE_X[e.from] + NODE_WIDTH, NODE_X[e.to], src.top, src.bottom, dst.top, dst.bottom)
        : arcRibbon(
            NODE_X[e.from] + NODE_WIDTH,
            NODE_X[e.to],
            src.top,
            src.bottom,
            dst.top,
            dst.bottom,
            TOP_MARGIN + HEADER_SPACE + ((arcIndex + 1) * ARC_LANE) / (arcEdgeKeys.length + 1)
          );
    return { key, d, color: NODE_COLOR[e.to], label: `${NODE_LABEL[e.from]} → ${NODE_LABEL[e.to]}`, value: e.count };
  });
  // edges/drawableEdges' order follows status_history's query order — not
  // meaningful for rendering and not worth trusting to stay identical
  // between two evaluations. Sort into a fixed, data-independent order
  // (by column position) so what's rendered can't shift regardless.
  ribbons.sort((a, b) => a.key.localeCompare(b.key));

  const barHeight: Record<string, number> = {};
  for (const n of activeNodes) barHeight[n] = nodeTotal[n] * unit;

  const maxPipelineHeight = activePipeline.length ? Math.max(...activePipeline.map((n) => barHeight[n])) : 0;
  const terminalStackHeight = activeTerminals.length ? terminalCursor - TERMINAL_GAP - barTop : 0;
  const chartHeight = barTop + Math.max(maxPipelineHeight, terminalStackHeight) + TOP_MARGIN + 16;
  // Always the full 4-column width, even when only "Applied" has data yet —
  // otherwise the viewBox's aspect ratio collapses toward square with few
  // active columns, and stretching that to the container's full width blows
  // the chart up disproportionately tall.
  const viewBoxWidth = COLUMN_X[COLUMN_X.length - 1] + NODE_WIDTH + 130;
  const summary = activeNodes.map((n) => `${NODE_LABEL[n]} ${nodeTotal[n]}`).join(", ");

  return (
    <div>
      <p className="mb-2 font-mono text-[11px] text-ink-soft">
        Blue deepens with pipeline progress (Applied → OA → Interview) · final outcomes at right
      </p>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${chartHeight}`}
        role="img"
        aria-label={`Application flow: ${grandTotal} total — ${summary}`}
        className="w-full"
      >
        {ribbons.map((r) => (
          <path key={r.key} d={r.d} fill={r.color} fillOpacity={0.4}>
            <title>{`${r.label}: ${r.value}`}</title>
          </path>
        ))}

        {activeNodes.map((n) => (
          <g key={n}>
            <rect
              x={NODE_X[n]}
              y={nodeTop[n]}
              width={NODE_WIDTH}
              height={barHeight[n]}
              rx={NODE_RADIUS}
              fill={NODE_COLOR[n]}
            >
              <title>{`${NODE_LABEL[n]}: ${nodeTotal[n]} total${exitCount[n] ? `, ${exitCount[n]} currently here` : ""}`}</title>
            </rect>
            <text
              x={NODE_X[n] + NODE_WIDTH / 2}
              y={activePipeline.includes(n) ? TOP_MARGIN + 12 : nodeTop[n] - 6}
              textAnchor="middle"
              className="fill-ink font-sans text-[13px] font-semibold"
            >
              {NODE_ICON[n] ? `${NODE_ICON[n]} ` : ""}
              {NODE_LABEL[n]}
            </text>
            <text
              x={NODE_X[n] + NODE_WIDTH / 2}
              y={nodeTop[n] + barHeight[n] + 16}
              textAnchor="middle"
              className="fill-ink-soft font-mono text-[11px]"
            >
              {nodeTotal[n]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
