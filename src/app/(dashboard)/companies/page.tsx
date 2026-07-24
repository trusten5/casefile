import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { CompanyDirectory } from "./CompanyDirectory";
import { CompanyCard } from "./CompanyCard";
import { TopCompanies } from "./TopCompanies";

// No per-request Next API is used here (no auth()/searchParams), so Next
// would otherwise prerender this once at build time — force fresh data
// every request instead, since posting counts change with every sync.
export const dynamic = "force-dynamic";

// Snapped to midnight (not a rolling `Date.now() - Nd`) so every call
// anywhere in this request's render returns the identical value no matter
// how far apart in wall-clock time they land — a raw Date.now() here caused
// a hydration mismatch (two renders of this page, seconds+ apart because of
// the paginated fetch below, disagreed on which side of the cutoff a
// posting fell). Same pattern as dashboard/page.tsx's startOfTodayISO.
// ponytail: day-granularity means "last 24h" is really "since yesterday's
// midnight" (up to 48h) — fine for a chart bucket.
function daysAgoISO(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

const CHART_WINDOW_DAYS: Record<string, number | null> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  all: null,
};

function matchesChartType(roleType: string | null, chartType: string) {
  if (!chartType) return true;
  if (chartType === "internship") return roleType === "internship";
  // "Full-time" in the chart filter is the layperson's binary (not
  // internship) — it covers both new_grad and full_time role_type values.
  if (chartType === "full_time") return roleType !== "internship";
  return true;
}

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_notable: boolean;
  postings: { count: number }[] | null;
};

const PAGE_SIZE = 1000;

// Supabase caps an unpaged select at 1000 rows — with 20k+ active postings
// across 200 companies, a single `.select()` silently dropped most
// companies out of firstSeenAt/mostRecentTitle/recentCount even though
// their real activeCount (a DB-side count, not row-limited) was correct.
async function fetchAllActivePostings(supabase: ReturnType<typeof getSupabase>) {
  const rows: { company_id: string; title: string; posted_at: string; role_type: string | null }[] =
    [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("postings")
      .select("company_id, title, posted_at, role_type")
      .eq("is_active", true)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

type CompanyRollup = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isNotable: boolean;
  activeCount: number;
  recentCount: number;
  firstSeenAt: string | null;
  mostRecentTitle: string | null;
};

// The company list + a full scan of every active posting are the same for
// every visitor (service-role client, no RLS) and only actually change once
// a day when the sync cron runs — so cache them instead of re-running a
// 20+-page scan of 20k+ postings on every single /companies load. The sync
// route calls revalidateTag("postings") right after it finishes, so this
// stays accurate to the last sync instead of just going stale for an hour.
//
// Caches the reduced per-company rollup, not the raw posting rows — the
// 20k+-row scan result is ~4MB serialized, over unstable_cache's 2MB per-entry
// cap (confirmed by testing: it silently failed to cache and re-ran every
// request). ~200 companies' worth of aggregates is a few KB, comfortably
// under that cap. chartWindow/chartType are part of the function's
// arguments, so each combination the UI can request gets its own cache
// entry instead of overwriting a single shared one.
const getCachedCompanyRollups = unstable_cache(
  async (chartWindow: string, chartType: string): Promise<{ companies: CompanyRollup[]; errorMessage: string | null }> => {
    const supabase = getSupabase();
    const [{ data, error }, activePostings] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, slug, logo_url, is_notable, postings(count)")
        .eq("postings.is_active", true)
        .order("name")
        .returns<CompanyRow[]>(),
      fetchAllActivePostings(supabase),
    ]);

    // No min()/max()-over-group in a single PostgREST call (aggregates are
    // disabled), so reduce the active postings client-side instead.
    const windowDays = CHART_WINDOW_DAYS[chartWindow];
    const cutoff = windowDays === null ? null : daysAgoISO(windowDays);
    const firstSeenAt = new Map<string, string>();
    const mostRecent = new Map<string, { title: string; postedAt: string }>();
    const recentCount = new Map<string, number>();
    for (const p of activePostings) {
      const first = firstSeenAt.get(p.company_id);
      if (!first || p.posted_at < first) firstSeenAt.set(p.company_id, p.posted_at);

      const recent = mostRecent.get(p.company_id);
      if (!recent || p.posted_at > recent.postedAt) {
        mostRecent.set(p.company_id, { title: p.title, postedAt: p.posted_at });
      }

      const inWindow = cutoff === null || p.posted_at >= cutoff;
      if (inWindow && matchesChartType(p.role_type, chartType)) {
        recentCount.set(p.company_id, (recentCount.get(p.company_id) ?? 0) + 1);
      }
    }

    const companies = (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      logoUrl: c.logo_url,
      isNotable: c.is_notable,
      activeCount: c.postings?.[0]?.count ?? 0,
      recentCount: recentCount.get(c.id) ?? 0,
      firstSeenAt: firstSeenAt.get(c.id) ?? null,
      mostRecentTitle: mostRecent.get(c.id)?.title ?? null,
    }));

    return { companies, errorMessage: error?.message ?? null };
  },
  ["companies-rollups"],
  { tags: ["postings"], revalidate: 3600 }
);

export default async function CompaniesPage(props: PageProps<"/companies">) {
  const { userId } = await auth();
  const searchParams = await props.searchParams;
  const chartWindow =
    typeof searchParams.window === "string" && searchParams.window in CHART_WINDOW_DAYS
      ? searchParams.window
      : "24h";
  const chartType = typeof searchParams.type === "string" ? searchParams.type : "";
  const supabase = getSupabase();

  const [{ companies: rollups, errorMessage }, { data: savedRows }, { data: contactRows }] =
    await Promise.all([
      getCachedCompanyRollups(chartWindow, chartType),
      userId
        ? supabase.from("saved_companies").select("company_id").eq("user_id", userId)
        : Promise.resolve({ data: [] as { company_id: string }[] }),
      userId
        ? supabase.from("contacts").select("company_id").eq("user_id", userId)
        : Promise.resolve({ data: [] as { company_id: string | null }[] }),
    ]);
  const error = errorMessage ? new Error(errorMessage) : null;

  const savedCompanyIds = new Set((savedRows ?? []).map((r) => r.company_id));
  const contactCounts = new Map<string, number>();
  for (const row of contactRows ?? []) {
    if (!row.company_id) continue;
    contactCounts.set(row.company_id, (contactCounts.get(row.company_id) ?? 0) + 1);
  }

  const companies = rollups.map((c) => ({
    ...c,
    isSaved: savedCompanyIds.has(c.id),
    contactCount: contactCounts.get(c.id) ?? 0,
  }));

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Companies</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every company in the feed — {companies.length} tracked and counting.
      </p>

      {error && (
        <p className="mt-6 text-sm text-status-rejected">
          Couldn&apos;t load companies: {error.message}
        </p>
      )}

      <TopCompanies companies={companies} chartWindow={chartWindow} chartType={chartType} />

      <h2 className="mt-12 font-display text-lg font-semibold text-ink">Saved companies</h2>
      {companies.some((c) => c.isSaved) ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies
            .filter((c) => c.isSaved)
            .map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">
          Nothing saved yet — hit Save on a company below or in the feed.
        </p>
      )}

      <h2 className="mt-12 font-display text-lg font-semibold text-ink">All companies</h2>
      <CompanyDirectory companies={companies} />
    </div>
  );
}
