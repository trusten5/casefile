import Link from "next/link";
import { CompanyLogo } from "@/components/CompanyLogo";
import { HorizontalBarChart, type BarRow } from "@/components/HorizontalBarChart";
import { ChartFilters } from "./ChartFilters";

const WINDOW_LABELS: Record<string, string> = {
  "24h": "in the last 24 hours",
  "7d": "in the last 7 days",
  "30d": "in the last 30 days",
  all: "of all time",
};

type Company = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isNotable: boolean;
  activeCount: number;
  recentCount: number;
};

// Matches --status-applied in globals.css — hardcoded because SVG fill
// doesn't reliably resolve CSS custom properties across browsers (same
// reasoning as the marketing page's Sankey).
const BAR_COLOR = "#2B3A55";

function JobPostingsChart({ companies, windowLabel }: { companies: Company[]; windowLabel: string }) {
  // Tiebreak by id so equal-count companies always land in the same relative
  // order — otherwise a tie's position depends on `companies`' own incoming
  // order, which isn't guaranteed stable across repeated identical queries.
  const top = [...companies]
    .filter((c) => c.recentCount > 0)
    .sort((a, b) => b.recentCount - a.recentCount || a.id.localeCompare(b.id))
    .slice(0, 10);

  const rows: BarRow[] = top.map((c) => ({
    id: c.id,
    label: c.name,
    value: c.recentCount,
    tooltip: `${c.name} — ${c.recentCount} posting${c.recentCount === 1 ? "" : "s"} ${windowLabel}`,
  }));

  return <HorizontalBarChart rows={rows} color={BAR_COLOR} ariaLabel={`Top companies by postings ${windowLabel}`} />;
}

export function TopCompanies({
  companies,
  chartWindow,
  chartType,
}: {
  companies: Company[];
  chartWindow: string;
  chartType: string;
}) {
  const notable = companies.filter((c) => c.isNotable);
  const windowLabel = WINDOW_LABELS[chartWindow] ?? WINDOW_LABELS["24h"];

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-semibold text-ink">Top companies</h2>

      {notable.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Popular companies
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {notable.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.slug}`}
                className="flex items-center gap-2 rounded-full border border-paper-line bg-tab/20 py-1.5 pl-2 pr-4 hover:border-ink-soft"
              >
                <CompanyLogo name={c.name} logoUrl={c.logoUrl} />
                <span className="text-sm font-medium text-ink">{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Most postings {windowLabel}
          </p>
          <ChartFilters initialWindow={chartWindow} initialType={chartType} />
        </div>
        <div className="mt-3 rounded-lg border border-paper-line bg-tab/10 p-4">
          <JobPostingsChart companies={companies} windowLabel={windowLabel} />
        </div>
      </div>
    </section>
  );
}
