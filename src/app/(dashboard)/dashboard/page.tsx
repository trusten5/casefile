import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { STATUSES, getFunnelCounts } from "@/lib/applications";
import { getUserPreferences } from "@/lib/preferences";
import { Flash } from "@/components/Flash";
import { PostingRow } from "../feed/PostingRow";

function startOfTodayISO() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

// Belt-and-suspenders alongside the redirect() below — see the note on
// applications/page.tsx's own force-dynamic export for why this matters.
export const dynamic = "force-dynamic";

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const supabase = getSupabase();
  const searchParams = await props.searchParams;
  const flash = typeof searchParams.flash === "string" ? searchParams.flash : undefined;

  const [
    counts,
    preferences,
    todayResult,
    postingsResult,
    savedResult,
    savedCountResult,
    appliedResult,
    followUpsResult,
  ] = await Promise.all([
    getFunnelCounts(supabase, userId),
    getUserPreferences(supabase, userId),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("applied_at", startOfTodayISO()),
    supabase
      .from("postings")
      .select("id, title, location, role_type, url, posted_at, company:companies(name, logo_url, slug)")
      .eq("is_active", true)
      .is("reported_broken_at", null)
      .order("posted_at", { ascending: false })
      .limit(5),
    supabase.from("saved_postings").select("posting_id").eq("user_id", userId),
    supabase
      .from("saved_postings")
      .select("posting_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("applications")
      .select("posting_id")
      .eq("user_id", userId)
      .not("posting_id", "is", null),
    supabase
      .from("interactions")
      .select("id, type, follow_up_date, contact:contacts!inner(id, name, user_id)")
      .eq("contact.user_id", userId)
      .not("follow_up_date", "is", null)
      .gte("follow_up_date", startOfTodayISO().slice(0, 10))
      .order("follow_up_date", { ascending: true })
      .limit(5),
  ]);

  const savedIds = new Set((savedResult.data ?? []).map((row) => row.posting_id));
  const appliedIds = new Set((appliedResult.data ?? []).map((row) => row.posting_id));
  const totalApplications = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const latestPostings = postingsResult.data ?? [];
  const upcomingFollowUps = (followUpsResult.data ?? []).map((f) => ({
    id: f.id,
    followUpDate: f.follow_up_date as string,
    contact: Array.isArray(f.contact) ? f.contact[0] : f.contact,
  }));

  return (
    <div>
      <Flash message={flash} />
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">Your daily home base for the hunt.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Today</p>
          <p className="font-display text-xl font-semibold text-ink">
            {todayResult.count ?? 0} / {preferences.dailyGoal} applied
          </p>
        </div>
        <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Total applications</p>
          <p className="font-display text-xl font-semibold text-ink">{totalApplications}</p>
        </div>
        <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Saved postings</p>
          <p className="font-display text-xl font-semibold text-ink">{savedCountResult.count ?? 0}</p>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Your funnel</h2>
          <Link href="/applications" className="text-sm font-medium text-ink-soft hover:text-ink">
            View all →
          </Link>
        </div>
        {totalApplications === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-paper-line p-6 text-center">
            <p className="text-sm text-ink-soft">
              Nothing tracked yet — grab a posting from the feed or add one manually.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/feed" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
                Browse the feed
              </Link>
              <Link
                href="/applications"
                className="rounded-md border border-paper-line px-4 py-2 text-sm text-ink"
              >
                Add an application
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-4">
            {STATUSES.map((s) => (
              <div key={s.value} className="rounded-lg border border-paper-line bg-tab/30 px-4 py-2">
                <p className={`font-mono text-xs uppercase tracking-wide ${s.color}`}>{s.label}</p>
                <p className="font-display text-xl font-semibold text-ink">{counts[s.value]}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Latest postings</h2>
          <Link href="/feed" className="text-sm font-medium text-ink-soft hover:text-ink">
            See full feed →
          </Link>
        </div>
        {latestPostings.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            No postings synced yet — once the feed pulls postings in, the newest ones show up here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-paper-line">
            {latestPostings.map((posting) => (
              <PostingRow
                key={posting.id}
                posting={posting}
                isSaved={savedIds.has(posting.id)}
                isApplied={appliedIds.has(posting.id)}
                returnTo="/dashboard"
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Upcoming follow-ups</h2>
          <Link href="/contacts" className="text-sm font-medium text-ink-soft hover:text-ink">
            Go to contacts →
          </Link>
        </div>
        {upcomingFollowUps.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Nothing due — log a coffee chat or referral on the{" "}
            <Link href="/contacts" className="underline">
              Contacts
            </Link>{" "}
            page and set a follow-up date to see it here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-paper-line">
            {upcomingFollowUps.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 py-3">
                <Link
                  href={`/contacts/${f.contact?.id}`}
                  className="text-sm font-medium text-ink hover:underline"
                >
                  {f.contact?.name ?? "Unknown contact"}
                </Link>
                <span className="font-mono text-xs text-status-oa">{f.followUpDate}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
