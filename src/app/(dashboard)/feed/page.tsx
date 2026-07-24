import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { applyPostingFilters } from "@/lib/postingFilters";
import { Flash } from "@/components/Flash";
import { PostingRow } from "./PostingRow";
import { FeedFilters } from "./FeedFilters";

// Same risk as applications/page.tsx had: per-user data (saved/applied) with
// no unconditional redirect to signal dynamic rendering, so without this
// the page could serve a prerendered shell that a later request contradicts.
export const dynamic = "force-dynamic";

type SavedFilterRow = {
  id: string;
  name: string;
  company: string;
  role_type: string;
  location: string;
  keyword: string;
  level: string;
  is_default: boolean;
};

const FILTER_KEYS = ["company", "roleType", "location", "keyword", "level"];

export default async function FeedPage(props: PageProps<"/feed">) {
  const { userId } = await auth();
  const searchParams = await props.searchParams;
  const flash = typeof searchParams.flash === "string" ? searchParams.flash : undefined;
  const supabase = getSupabase();

  const [{ data: presets }, { data: savedCompanyRows }] = await Promise.all([
    userId
      ? supabase
          .from("saved_filters")
          .select("id, name, company, role_type, location, keyword, level, is_default")
          .eq("user_id", userId)
          .eq("scope", "feed")
          .order("name")
      : Promise.resolve({ data: [] as SavedFilterRow[] }),
    userId
      ? supabase
          .from("saved_companies")
          .select("company_id, company:companies(name)")
          .eq("user_id", userId)
      : Promise.resolve({
          data: [] as { company_id: string; company: { name: string } | { name: string }[] | null }[],
        }),
  ]);

  const savedCompanyNames = Array.from(
    new Set(
      (savedCompanyRows ?? [])
        .map((r) => (Array.isArray(r.company) ? r.company[0]?.name : r.company?.name))
        .filter((name): name is string => Boolean(name))
    )
  );
  const savedCompanyIds = (savedCompanyRows ?? []).map((r) => r.company_id);

  // A bare visit (no filter keys in the URL at all) uses the default
  // preset's values, if one exists; the moment any filter key is present,
  // the URL wins outright — same all-or-nothing rule "Clear filters" implies.
  const hasExplicitFilters = FILTER_KEYS.some((k) => k in searchParams);
  const defaultPreset = !hasExplicitFilters ? (presets ?? []).find((p) => p.is_default) : undefined;

  const company = typeof searchParams.company === "string" ? searchParams.company : defaultPreset?.company ?? "";
  const roleType =
    typeof searchParams.roleType === "string" ? searchParams.roleType : defaultPreset?.role_type ?? "";
  const location =
    typeof searchParams.location === "string" ? searchParams.location : defaultPreset?.location ?? "";
  const keyword =
    typeof searchParams.keyword === "string" ? searchParams.keyword : defaultPreset?.keyword ?? "";
  const level = typeof searchParams.level === "string" ? searchParams.level : defaultPreset?.level ?? "";
  // Its own param rather than a PostingFilters field — it's a /feed-only
  // concept the landing teaser and digest cron (the type's other users)
  // don't need, and it replaces the company text filter rather than
  // combining with it, so it's not carried on saved-filter presets either.
  const savedCompaniesOnly = searchParams.savedCompanies === "1";

  // `!inner` makes the embedded company filterable (company.name) — every
  // posting always has a company, so this doesn't change which rows match.
  let query = applyPostingFilters(
    supabase
      .from("postings")
      .select(
        "id, title, location, role_type, url, posted_at, company:companies!inner(name, slug, logo_url)"
      )
      .eq("is_active", true)
      .order("posted_at", { ascending: false })
      .limit(60),
    { company: savedCompaniesOnly ? "" : company, roleType, location, keyword, level }
  );
  if (savedCompaniesOnly) {
    // An empty `.in()` list would otherwise match nothing predictably across
    // PostgREST versions — force zero rows with a UUID that can't exist.
    query = query.in(
      "company_id",
      savedCompanyIds.length > 0 ? savedCompanyIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  const { data: postings, error } = await query;

  const [{ data: saved }, { data: applied }] = await Promise.all([
    userId
      ? supabase.from("saved_postings").select("posting_id").eq("user_id", userId)
      : Promise.resolve({ data: [] }),
    userId
      ? supabase
          .from("applications")
          .select("posting_id")
          .eq("user_id", userId)
          .not("posting_id", "is", null)
      : Promise.resolve({ data: [] }),
  ]);
  const savedIds = new Set((saved ?? []).map((row) => row.posting_id));
  const appliedIds = new Set((applied ?? []).map((row) => row.posting_id));

  return (
    <div>
      <Flash message={flash} />
      <h1 className="font-display text-2xl font-semibold text-ink">Feed</h1>
      <p className="mt-1 font-mono text-xs text-ink-soft">Sorted by date posted — newest first.</p>

      <FeedFilters
        initialCompany={company}
        initialRoleType={roleType}
        initialLocation={location}
        initialKeyword={keyword}
        initialLevel={level}
        initialSavedCompaniesOnly={savedCompaniesOnly}
        presets={(presets ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          company: p.company,
          roleType: p.role_type,
          location: p.location,
          keyword: p.keyword,
          level: p.level,
        }))}
        savedCompanies={savedCompanyNames}
      />

      {error && (
        <p className="mt-6 text-sm text-status-rejected">
          Couldn&apos;t load postings: {error.message}
        </p>
      )}

      <ul className="mt-8 divide-y divide-paper-line">
        {(postings ?? []).map((posting) => (
          <PostingRow
            key={posting.id}
            posting={posting}
            isSaved={savedIds.has(posting.id)}
            isApplied={appliedIds.has(posting.id)}
            returnTo="/feed"
          />
        ))}
      </ul>

      {postings?.length === 0 && !error && (
        <p className="mt-8 text-sm text-ink-soft">
          No postings match those filters yet — try clearing one.
        </p>
      )}
    </div>
  );
}
