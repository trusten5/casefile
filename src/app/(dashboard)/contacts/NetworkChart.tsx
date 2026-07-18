import { HorizontalBarChart, type BarRow } from "@/components/HorizontalBarChart";

const BAR_COLOR = "#2B3A55"; // matches --status-applied, same reasoning as TopCompanies/ApplicationSankey

type CompanyNetwork = {
  id: string;
  name: string;
  recentCount: number;
  contactCount: number;
};

export function NetworkChart({ companies }: { companies: CompanyNetwork[] }) {
  // Tiebreak by id for the same reason as TopCompanies' chart — equal-count
  // companies otherwise land in whatever order the incoming array happens
  // to have, which isn't guaranteed stable across repeated identical queries.
  const top = [...companies]
    .filter((c) => c.recentCount > 0)
    .sort((a, b) => b.recentCount - a.recentCount || a.id.localeCompare(b.id))
    .slice(0, 10);

  if (top.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-soft">
        No recent postings yet at companies you know people at — check back after your next sync.
      </p>
    );
  }

  const rows: BarRow[] = top.map((c) => ({
    id: c.id,
    label: c.name,
    value: c.recentCount,
    tooltip: `${c.name} — ${c.recentCount} posting${c.recentCount === 1 ? "" : "s"} this week · ${c.contactCount} contact${c.contactCount === 1 ? "" : "s"} here`,
  }));

  return (
    <div className="mt-3 rounded-lg border border-paper-line bg-tab/10 p-4">
      <HorizontalBarChart
        rows={rows}
        color={BAR_COLOR}
        ariaLabel="Companies you know people at, by postings this week"
      />
    </div>
  );
}
