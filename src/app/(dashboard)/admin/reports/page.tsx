import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";
import { Flash } from "@/components/Flash";
import { formatPostedDate } from "@/lib/dates";
import { confirmBroken, dismissReport } from "../actions";
import { ScrapingStats, type SourceStat, type SyncRun, type TopCompany } from "../ScrapingStats";

export const dynamic = "force-dynamic";

type ReportedPosting = {
  id: string;
  title: string;
  url: string;
  posted_at: string;
  reported_broken_at: string;
  company: { name: string } | { name: string }[] | null;
};

type CompanyWithCount = { id: string; name: string; postings: { count: number }[] | null };

function companyName(company: ReportedPosting["company"]) {
  if (!company) return "Unknown company";
  return Array.isArray(company) ? (company[0]?.name ?? "Unknown company") : company.name;
}

export default async function AdminReportsPage(props: PageProps<"/admin/reports">) {
  if (!(await isAdmin())) notFound();

  const searchParams = await props.searchParams;
  const flash = typeof searchParams.flash === "string" ? searchParams.flash : undefined;
  const supabase = getSupabase();

  const [
    { data: reports, error },
    { count: totalActive },
    { count: totalCompanies },
    { data: sourceStats },
    { data: companyRows },
    { data: recentRuns },
    { count: fullTimeCount },
    { count: internshipCount },
    { count: newGradCount },
  ] = await Promise.all([
    supabase
      .from("postings")
      .select("id, title, url, posted_at, reported_broken_at, company:companies(name)")
      .not("reported_broken_at", "is", null)
      .eq("is_active", true)
      .order("reported_broken_at", { ascending: false })
      .returns<ReportedPosting[]>(),
    supabase.from("postings").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase
      .from("source_stats")
      .select("*")
      .order("active_postings", { ascending: false })
      .returns<SourceStat[]>(),
    supabase
      .from("companies")
      .select("id, name, postings(count)")
      .eq("postings.is_active", true)
      .returns<CompanyWithCount[]>(),
    supabase
      .from("sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(8)
      .returns<SyncRun[]>(),
    supabase
      .from("postings")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("role_type", "full_time"),
    supabase
      .from("postings")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("role_type", "internship"),
    supabase
      .from("postings")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("role_type", "new_grad"),
  ]);

  const topCompanies: TopCompany[] = (companyRows ?? [])
    .map((c) => ({ id: c.id, name: c.name, activePostings: c.postings?.[0]?.count ?? 0 }))
    .filter((c) => c.activePostings > 0)
    .sort((a, b) => b.activePostings - a.activePostings)
    .slice(0, 10);

  return (
    <div>
      <Flash message={flash} />
      <Link
        href="/admin/content"
        className="inline-block rounded-md border border-paper-line px-3 py-1.5 text-sm text-ink"
      >
        Content draft →
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Reported links</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Postings someone flagged as broken — still live in the feed until you confirm or dismiss.
      </p>

      {error && (
        <p className="mt-6 text-sm text-status-rejected">
          Couldn&apos;t load reports: {error.message}
        </p>
      )}

      {reports?.length === 0 && !error && (
        <p className="mt-8 text-sm text-ink-soft">Nothing pending review.</p>
      )}

      <ul className="mt-6 divide-y divide-paper-line">
        {(reports ?? []).map((posting) => (
          <li key={posting.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <a
                href={posting.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink hover:underline"
              >
                {posting.title}
              </a>
              <p className="text-sm text-ink-soft">
                {companyName(posting.company)} — posted {formatPostedDate(posting.posted_at)}
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-soft">
                Reported {formatPostedDate(posting.reported_broken_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <form action={confirmBroken.bind(null, posting.id)}>
                <button
                  type="submit"
                  className="rounded-md bg-status-rejected px-3 py-1.5 text-sm font-medium text-paper"
                >
                  Confirm broken
                </button>
              </form>
              <form action={dismissReport.bind(null, posting.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-paper-line px-3 py-1.5 text-sm text-ink"
                >
                  Dismiss
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <ScrapingStats
        totalActive={totalActive ?? 0}
        totalCompanies={totalCompanies ?? 0}
        sourceStats={sourceStats ?? []}
        topCompanies={topCompanies}
        recentRuns={recentRuns ?? []}
        roleCounts={{
          full_time: fullTimeCount ?? 0,
          internship: internshipCount ?? 0,
          new_grad: newGradCount ?? 0,
        }}
      />
    </div>
  );
}
