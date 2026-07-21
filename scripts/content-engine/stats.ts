import { getSupabase } from "../../src/lib/supabase";

// Real, verifiable numbers for the data-driven pillars (company intel,
// data/numbers). Every field here must be something you could re-derive
// by hand from the DB — generateCopy.ts hands this straight to the model
// as grounding and instructs it never to state a number that isn't in here.

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ContentStats {
  totalActivePostings: number;
  postingsBySource: { source: string; activePostings: number; companies: number }[];
  postingsLast7Days: number;
  postingsPrior7Days: number;
  busiestDayOfWeek: string;
  recentlyPostingCompanies: string[];
  windowDays: number;
  latestSyncAt: string | null;
}

export async function getContentStats(): Promise<ContentStats> {
  const supabase = getSupabase();
  const windowDays = 30;
  const since = new Date(Date.now() - windowDays * DAY_MS).toISOString();

  const [{ data: sourceStats }, { data: recentPostings }, { data: latestSync }] = await Promise.all([
    supabase.from("source_stats").select("source, active_postings, companies"),
    supabase
      .from("postings")
      .select("first_seen_at, company:companies(name)")
      .eq("is_active", true)
      .gte("first_seen_at", since)
      .order("first_seen_at", { ascending: false })
      .limit(2000),
    supabase
      .from("sync_runs")
      .select("started_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = recentPostings ?? [];
  const now = Date.now();
  const last7 = rows.filter((r) => now - new Date(r.first_seen_at).getTime() <= 7 * DAY_MS);
  const prior7 = rows.filter((r) => {
    const age = now - new Date(r.first_seen_at).getTime();
    return age > 7 * DAY_MS && age <= 14 * DAY_MS;
  });

  const dayCounts = new Array(7).fill(0);
  for (const r of rows) dayCounts[new Date(r.first_seen_at).getDay()]++;
  const busiestDayOfWeek = DAY_NAMES[dayCounts.indexOf(Math.max(...dayCounts))];

  const recentlyPostingCompanies = Array.from(
    new Set(
      last7
        .map((r) => (r.company as unknown as { name: string } | null)?.name)
        .filter((name): name is string => Boolean(name))
    )
  ).slice(0, 5);

  return {
    totalActivePostings: (sourceStats ?? []).reduce((sum, s) => sum + s.active_postings, 0),
    postingsBySource: (sourceStats ?? []).map((s) => ({
      source: s.source,
      activePostings: s.active_postings,
      companies: s.companies,
    })),
    postingsLast7Days: last7.length,
    postingsPrior7Days: prior7.length,
    busiestDayOfWeek,
    recentlyPostingCompanies,
    windowDays,
    latestSyncAt: latestSync?.started_at ?? null,
  };
}
