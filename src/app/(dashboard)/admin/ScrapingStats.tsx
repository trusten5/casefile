import { HorizontalBarChart, type BarRow } from "@/components/HorizontalBarChart";
import { formatPostedDate } from "@/lib/dates";

// Matches the source colors picked for the scraping-report artifact — kept
// hardcoded since SVG fill doesn't reliably resolve CSS custom properties
// (same reasoning as TopCompanies.tsx's BAR_COLOR).
const SOURCE_COLORS: Record<string, string> = {
  greenhouse: "#a9631f",
  lever: "#1d6fa5",
  ashby: "#9a3e6b",
  "community:vanshb03": "#3f7d4a",
};
const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  "community:vanshb03": "Community feed",
};

export type SourceStat = { source: string; active_postings: number; companies: number };
export type SyncRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  companies_ok: number | null;
  companies_failed: number | null;
  community_synced: number | null;
  link_checked: number | null;
  link_dead: number | null;
  error: string | null;
};
export type TopCompany = { id: string; name: string; activePostings: number };
export type RoleCounts = { full_time: number; internship: number; new_grad: number };

function runDurationLabel(run: SyncRun) {
  if (!run.finished_at) return "in progress";
  const seconds = Math.round(
    (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000
  );
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
}

export function ScrapingStats({
  totalActive,
  totalCompanies,
  sourceStats,
  topCompanies,
  recentRuns,
  roleCounts,
}: {
  totalActive: number;
  totalCompanies: number;
  sourceStats: SourceStat[];
  topCompanies: TopCompany[];
  recentRuns: SyncRun[];
  roleCounts: RoleCounts;
}) {
  const lastRun = recentRuns[0];
  const sourceRows: BarRow[] = sourceStats.map((s) => ({
    id: s.source,
    label: SOURCE_LABELS[s.source] ?? s.source,
    value: s.active_postings,
    tooltip: `${SOURCE_LABELS[s.source] ?? s.source}: ${s.active_postings} active postings across ${s.companies} companies`,
  }));
  const topRows: BarRow[] = topCompanies.map((c) => ({
    id: c.id,
    label: c.name,
    value: c.activePostings,
    tooltip: `${c.name}: ${c.activePostings} active postings`,
  }));
  const roleTotal = roleCounts.full_time + roleCounts.internship + roleCounts.new_grad;

  return (
    <section className="mt-16">
      <h2 className="font-display text-lg font-semibold text-ink">Scraping &amp; cron</h2>
      <p className="mt-1 text-sm text-ink-soft">
        What the pipeline is configured to pull and what&apos;s actually in the database.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Active postings</p>
          <p className="font-display text-xl font-semibold text-ink">{totalActive.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Companies tracked</p>
          <p className="font-display text-xl font-semibold text-ink">{totalCompanies.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Cron schedule</p>
          <p className="font-display text-xl font-semibold text-ink">Daily · 13:00 UTC</p>
          <p className="mt-0.5 text-xs text-ink-soft">Hobby tier caps this at 1/day</p>
        </div>
        <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Last run</p>
          {lastRun ? (
            <>
              <p className="font-display text-xl font-semibold text-ink">
                {formatPostedDate(lastRun.started_at)}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {lastRun.error ? (
                  <span className="text-status-rejected">failed</span>
                ) : (
                  <>
                    {lastRun.companies_ok} ok
                    {Boolean(lastRun.companies_failed) && `, ${lastRun.companies_failed} failed`} ·{" "}
                    {runDurationLabel(lastRun)}
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="font-display text-xl font-semibold text-ink-soft">No runs logged</p>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Postings by source</p>
          <div className="mt-3 rounded-lg border border-paper-line bg-tab/10 p-4">
            {sourceRows.length > 0 ? (
              <div className="space-y-3">
                {sourceRows.map((r) => (
                  <HorizontalBarChart
                    key={r.id}
                    rows={[r]}
                    color={SOURCE_COLORS[r.id] ?? "#55584f"}
                    ariaLabel={r.label}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">No data yet.</p>
            )}
          </div>
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Top companies</p>
          <div className="mt-3 rounded-lg border border-paper-line bg-tab/10 p-4">
            {topRows.length > 0 ? (
              <HorizontalBarChart rows={topRows} color="#2B3A55" ariaLabel="Top companies by active postings" />
            ) : (
              <p className="text-sm text-ink-soft">No data yet.</p>
            )}
          </div>
        </div>
      </div>

      {roleTotal > 0 && (
        <div className="mt-8">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Role type mix</p>
          <div className="mt-3 flex h-6 overflow-hidden rounded-md border border-paper-line">
            <div
              style={{ width: `${(roleCounts.full_time / roleTotal) * 100}%` }}
              className="bg-[#a9631f]"
              title={`Full-time: ${roleCounts.full_time}`}
            />
            <div
              style={{ width: `${(roleCounts.internship / roleTotal) * 100}%` }}
              className="bg-[#9a3e6b]"
              title={`Internship: ${roleCounts.internship}`}
            />
            <div
              style={{ width: `${(roleCounts.new_grad / roleTotal) * 100}%` }}
              className="bg-[#1d6fa5]"
              title={`New grad: ${roleCounts.new_grad}`}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
            <span>{roleCounts.full_time.toLocaleString()} full-time</span>
            <span>{roleCounts.internship.toLocaleString()} internship</span>
            <span>{roleCounts.new_grad.toLocaleString()} new grad</span>
          </div>
        </div>
      )}

      <div className="mt-8">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Recent sync runs</p>
        {recentRuns.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            No runs logged yet — the next cron invocation (or a manual trigger) will show up here.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-paper-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-line text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Companies</th>
                  <th className="px-3 py-2">Community</th>
                  <th className="px-3 py-2">Links checked</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-b border-paper-line last:border-0">
                    <td className="px-3 py-2 text-ink">{formatPostedDate(run.started_at)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">{runDurationLabel(run)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                      {run.companies_ok ?? "—"}
                      {Boolean(run.companies_failed) && ` (${run.companies_failed} failed)`}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                      {run.community_synced ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                      {run.link_checked ?? "—"}
                      {Boolean(run.link_dead) && ` (${run.link_dead} dead)`}
                    </td>
                    <td className="px-3 py-2">
                      {run.error ? (
                        <span className="text-xs font-medium text-status-rejected">failed</span>
                      ) : (
                        <span className="text-xs font-medium text-status-offer">ok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
