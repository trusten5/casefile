import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { companyDisplayName, companyLogoUrl, companySlug } from "@/lib/companies";
import { STATUSES, getFunnelCounts, getApplicationFlow } from "@/lib/applications";
import { ROLE_TYPE_LABELS, ROLE_TYPE_STYLES } from "@/lib/roleType";
import { Flash } from "@/components/Flash";
import { CompanyLogo } from "@/components/CompanyLogo";
import { PostingRow } from "../feed/PostingRow";
import { ApplicationFilters } from "./ApplicationFilters";
import { ApplicationSankey } from "./ApplicationSankey";
import { createManualApplication } from "./actions";
import { ApplicationStatusControl } from "./ApplicationStatusControl";

// Without this, the page is eligible for a prerendered shell built from
// whatever data existed at that moment — a later real request's dynamic
// render then disagrees with it, which is exactly the hydration mismatch
// this page kept hitting even after memoizing the data fetches with
// cache(). Every other page here that fetches per-request data
// (companies, dashboard, feed) already has this; this one was the outlier.
export const dynamic = "force-dynamic";

type Preference = "internship" | "phd" | "new_grad";

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

const FILTER_KEYS = ["company", "roleType", "level"];

function inferPreference(applications: { role_type: string | null; is_phd: boolean }[]): Preference {
  let internship = 0;
  let phd = 0;
  let newGrad = 0;
  for (const a of applications) {
    if (a.is_phd) phd++;
    else if (a.role_type === "internship") internship++;
    else if (a.role_type === "new_grad") newGrad++;
  }
  if (phd > internship && phd > newGrad) return "phd";
  if (newGrad > internship) return "new_grad";
  return "internship";
}

export default async function ApplicationsPage(props: PageProps<"/applications">) {
  const { userId } = await auth();
  const supabase = getSupabase();
  const searchParams = await props.searchParams;
  const flash = typeof searchParams.flash === "string" ? searchParams.flash : undefined;

  const { data: presets } = userId
    ? await supabase
        .from("saved_filters")
        .select("id, name, company, role_type, location, keyword, level, is_default")
        .eq("user_id", userId)
        .eq("scope", "applications")
        .order("name")
    : { data: [] as SavedFilterRow[] };

  // Same all-or-nothing default-preset rule as Feed: a bare visit uses the
  // default preset's values; any filter key present in the URL wins outright.
  const hasExplicitFilters = FILTER_KEYS.some((k) => k in searchParams);
  const defaultPreset = !hasExplicitFilters ? (presets ?? []).find((p) => p.is_default) : undefined;

  const companyFilter =
    typeof searchParams.company === "string" ? searchParams.company : defaultPreset?.company ?? "";
  const roleTypeFilter =
    typeof searchParams.roleType === "string" ? searchParams.roleType : defaultPreset?.role_type ?? "";
  const levelFilter =
    typeof searchParams.level === "string" ? searchParams.level : defaultPreset?.level ?? "";

  // ponytail: hard cap, no "load more" UI yet — add pagination if a real
  // user's history grows past this (a full recruiting cycle is usually
  // well under it; this is a safety net against unbounded DOM growth, not
  // a limit anyone should realistically hit today).
  let applicationsQuery = supabase
    .from("applications")
    .select(
      "id, role_title, status, applied_at, role_type, is_phd, company:companies!inner(name, logo_url, slug)"
    )
    .order("applied_at", { ascending: false })
    .limit(200);
  if (userId) applicationsQuery = applicationsQuery.eq("user_id", userId);
  if (companyFilter) applicationsQuery = applicationsQuery.ilike("company.name", `%${companyFilter}%`);
  if (roleTypeFilter) applicationsQuery = applicationsQuery.eq("role_type", roleTypeFilter);
  if (levelFilter === "undergrad") applicationsQuery = applicationsQuery.eq("is_phd", false);
  if (levelFilter === "phd") applicationsQuery = applicationsQuery.eq("is_phd", true);

  const [{ data: applications, error }, counts, flow, { data: allApplicationsForPreference }] =
    await Promise.all([
      userId ? applicationsQuery : Promise.resolve({ data: [], error: null }),
      userId
        ? getFunnelCounts(supabase, userId)
        : Promise.resolve(Object.fromEntries(STATUSES.map((s) => [s.value, 0]))),
      userId
        ? getApplicationFlow(supabase, userId)
        : Promise.resolve({ entryCount: {}, exitCount: {}, edges: [] }),
      userId
        ? supabase.from("applications").select("role_type, is_phd").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
    ]);

  // Saved jobs — same filters as the applications list, applied to postings
  // directly (real postings, so they get the full feed-parity PostingRow).
  const { data: savedRows } = userId
    ? await supabase.from("saved_postings").select("posting_id").eq("user_id", userId)
    : { data: [] };
  const savedPostingIds = (savedRows ?? []).map((r) => r.posting_id);

  let savedJobs: Awaited<ReturnType<typeof fetchPostings>> = [];
  if (savedPostingIds.length > 0) {
    savedJobs = await fetchPostings(supabase, {
      ids: savedPostingIds,
      company: companyFilter,
      roleType: roleTypeFilter,
      level: levelFilter,
    });
  }

  const { data: appliedRows } = userId
    ? await supabase
        .from("applications")
        .select("posting_id")
        .eq("user_id", userId)
        .not("posting_id", "is", null)
    : { data: [] };
  const appliedPostingIds = new Set((appliedRows ?? []).map((r) => r.posting_id));
  const savedPostingIdSet = new Set(savedPostingIds);

  const preference = inferPreference(allApplicationsForPreference ?? []);
  const recommended = await fetchRecommended(supabase, preference, appliedPostingIds, savedPostingIdSet);

  return (
    <div>
      <Flash message={flash} />
      <h1 className="font-display text-2xl font-semibold text-ink">Applications</h1>

      <div className="mt-6 flex flex-wrap gap-4">
        {STATUSES.map((s) => (
          <div key={s.value} className="rounded-lg border border-paper-line bg-tab/30 px-4 py-2">
            <p className={`font-mono text-xs uppercase tracking-wide ${s.color}`}>{s.label}</p>
            <p className="font-display text-xl font-semibold text-ink">{counts[s.value]}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-paper-line bg-tab/10 p-4">
        <ApplicationSankey flow={flow} />
      </div>

      <form action={createManualApplication} className="mt-8 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Company
          <input
            name="companyName"
            required
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Role
          <input
            name="roleTitle"
            required
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Status
          <select
            name="status"
            defaultValue="applied"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
          Add application
        </button>
      </form>

      <ApplicationFilters
        initialCompany={companyFilter}
        initialRoleType={roleTypeFilter}
        initialLevel={levelFilter}
        presets={(presets ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          company: p.company,
          roleType: p.role_type,
          level: p.level,
        }))}
      />

      {error && (
        <p className="mt-6 text-sm text-status-rejected">
          Couldn&apos;t load applications: {error.message}
        </p>
      )}

      <ul className="mt-8 divide-y divide-paper-line">
        {(applications ?? []).map((application) => {
          const roleType = application.role_type;
          const companyName = companyDisplayName(application.company);
          const slug = companySlug(application.company);
          return (
            <li
              key={application.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {slug ? (
                  <Link href={`/companies/${slug}`}>
                    <CompanyLogo name={companyName} logoUrl={companyLogoUrl(application.company)} />
                  </Link>
                ) : (
                  <CompanyLogo name={companyName} logoUrl={companyLogoUrl(application.company)} />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words font-medium text-ink">{application.role_title}</p>
                    {roleType && ROLE_TYPE_LABELS[roleType] && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${ROLE_TYPE_STYLES[roleType]}`}
                      >
                        {ROLE_TYPE_LABELS[roleType]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-soft">
                    {slug ? (
                      <Link href={`/companies/${slug}`} className="hover:underline">
                        {companyName}
                      </Link>
                    ) : (
                      companyName
                    )}
                  </p>
                </div>
              </div>
              <ApplicationStatusControl
                applicationId={application.id}
                initialStatus={application.status}
              />
            </li>
          );
        })}
      </ul>

      {applications?.length === 0 && !error && (
        <p className="mt-8 text-sm text-ink-soft">
          No applications match those filters — add one above or hit Applied from the feed.
        </p>
      )}

      <section className="mt-12">
        <h2 className="font-display text-lg font-semibold text-ink">Saved jobs</h2>
        {savedJobs.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Nothing saved yet — hit Save on a posting in the feed.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-paper-line">
            {savedJobs.map((posting) => (
              <PostingRow
                key={posting.id}
                posting={posting}
                isSaved={true}
                isApplied={appliedPostingIds.has(posting.id)}
                returnTo="/applications"
              />
            ))}
          </ul>
        )}
      </section>

      {recommended.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-lg font-semibold text-ink">Recommended for you</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Based on your applications so far — mostly{" "}
            {preference === "phd" ? "PhD" : preference === "new_grad" ? "new grad" : "internship"}{" "}
            roles.
          </p>
          <ul className="mt-4 divide-y divide-paper-line">
            {recommended.map((posting) => (
              <PostingRow
                key={posting.id}
                posting={posting}
                isSaved={savedPostingIdSet.has(posting.id)}
                isApplied={appliedPostingIds.has(posting.id)}
                returnTo="/applications"
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

async function fetchPostings(
  supabase: ReturnType<typeof getSupabase>,
  {
    ids,
    company,
    roleType,
    level,
  }: { ids: string[]; company: string; roleType: string; level: string }
) {
  let query = supabase
    .from("postings")
    .select(
      "id, title, location, role_type, url, posted_at, company:companies!inner(name, logo_url, slug)"
    )
    .in("id", ids)
    .eq("is_active", true)
    .order("posted_at", { ascending: false });

  if (company) query = query.ilike("company.name", `%${company}%`);
  if (roleType) query = query.eq("role_type", roleType);
  if (level === "undergrad") query = query.eq("is_phd", false);
  if (level === "phd") query = query.eq("is_phd", true);

  const { data } = await query;
  return data ?? [];
}

async function fetchRecommended(
  supabase: ReturnType<typeof getSupabase>,
  preference: Preference,
  excludeApplied: Set<string>,
  excludeSaved: Set<string>
) {
  let query = supabase
    .from("postings")
    .select("id, title, location, role_type, url, posted_at, company:companies(name, logo_url, slug)")
    .eq("is_active", true)
    .order("posted_at", { ascending: false })
    .limit(15);

  if (preference === "phd") query = query.eq("is_phd", true);
  else query = query.eq("role_type", preference).eq("is_phd", false);

  const { data } = await query;
  return (data ?? [])
    .filter((p) => !excludeApplied.has(p.id) && !excludeSaved.has(p.id))
    .slice(0, 3);
}
