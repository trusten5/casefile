import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import {
  applyPostingFilters,
  parsePostingFilters,
  postingFiltersToQueryString,
} from "@/lib/postingFilters";
import { PublicHeader } from "@/components/PublicHeader";
import { PostingRow } from "./(dashboard)/feed/PostingRow";
import { FeedFilters } from "./(dashboard)/feed/FeedFilters";

const CTA_CLASS =
  "inline-flex items-center justify-center rounded bg-cobalt px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt";

// Flat, outline-only marks — no blur, no gradient, consistent with the
// rest of the app's stamped-paper language. A little texture in the
// margins, not a hero illustration.
function BackgroundMarks() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <svg
        className="absolute right-[6%] top-[4%] h-28 w-28 text-cobalt opacity-[0.14]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <circle cx="12" cy="12" r="10" />
      </svg>
      <svg
        className="absolute left-[3%] top-[34%] h-10 w-10 text-cobalt opacity-[0.22]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="4" y1="12" x2="20" y2="12" />
      </svg>
      <svg
        className="absolute right-[16%] bottom-[8%] h-7 w-7 text-cobalt opacity-[0.25]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="4" y1="12" x2="20" y2="12" />
      </svg>
      <svg
        className="absolute left-[8%] bottom-[2%] h-36 w-36 text-cobalt opacity-[0.09]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <circle cx="12" cy="12" r="10" />
      </svg>
    </div>
  );
}

function TeaserCard({ tab, heading, body }: { tab: string; heading: string; body: string }) {
  return (
    <div className="relative pt-7">
      <span className="absolute left-5 top-0 rounded-t bg-tab px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-soft">
        {tab}
      </span>
      <div className="h-full rounded-b rounded-tr border border-paper-line bg-tab/40 p-6">
        <h3 className="font-display text-lg font-semibold text-ink">{heading}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
      </div>
    </div>
  );
}

// Public landing page: the feed itself is the hero, browsable and
// filterable by anyone, right here — no navigation away required. Only
// signed-in visitors get redirected past it; "see the full feed" is the
// only way to leave for the fuller (60-result, saved-filter) view at /feed.
export default async function Home(props: PageProps<"/">) {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  const searchParams = await props.searchParams;
  const filters = parsePostingFilters(searchParams);

  const supabase = getSupabase();
  const query = applyPostingFilters(
    supabase
      .from("postings")
      .select(
        "id, title, location, role_type, url, posted_at, company:companies!inner(name, slug, logo_url)"
      )
      .eq("is_active", true)
      .order("posted_at", { ascending: false })
      .limit(10),
    filters
  );
  const { data: postings, error } = await query;
  const feedQuery = postingFiltersToQueryString(filters);

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />

      {/* hero: the live feed itself */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-16 pt-4">
        <BackgroundMarks />
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-status-rejected">
          Fall recruiting starts in weeks
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
          Every internship, new-grad, and full-time posting, in one feed.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
          Browse it free, no account needed. Sign up when you want to save a
          posting, track an application, or find who you already know at a
          company.
        </p>

        <FeedFilters
          initialCompany={filters.company}
          initialRoleType={filters.roleType}
          initialLocation={filters.location}
          initialKeyword={filters.keyword}
          initialLevel={filters.level}
          presets={[]}
          basePath="/"
        />

        {error && (
          <p className="mt-6 text-sm text-status-rejected">
            Couldn&apos;t load postings: {error.message}
          </p>
        )}

        <div className="relative mt-7 pt-7">
          <span className="absolute left-0 top-0 rounded-t bg-tab px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Live feed
          </span>
          {postings?.length ? (
            <ul className="divide-y divide-paper-line rounded-b rounded-tr border border-paper-line bg-tab/10 px-4">
              {postings.map((posting) => (
                <PostingRow
                  key={posting.id}
                  posting={posting}
                  isSaved={false}
                  isApplied={false}
                  returnTo="/feed"
                />
              ))}
            </ul>
          ) : (
            !error && (
              <p className="rounded-b rounded-tr border border-paper-line bg-tab/10 px-4 py-6 text-sm text-ink-soft">
                No postings match those filters yet — try clearing one.
              </p>
            )
          )}
        </div>

        <div className="mt-6">
          <Link
            href={feedQuery ? `/feed?${feedQuery}` : "/feed"}
            className="inline-flex items-center gap-1.5 rounded border border-paper-line px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink-soft"
          >
            See the full feed <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* capability teasers */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-ink-soft">
          What an account gets you
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
          Free for the daily loop.
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <TeaserCard
            tab="Track"
            heading="Save & track applications"
            body="Save postings and mark them applied — Casefile carries every application through OA, interview, offer, or rejected."
          />
          <TeaserCard
            tab="File"
            heading="One place for every status"
            body="Log the confirmation, the OA invite, or the rejection as it comes in — every application moves through the same funnel: applied, OA, interview, offer, or rejected."
          />
          <TeaserCard
            tab="Connect"
            heading="Your network, working for you"
            body="Log a coffee chat once. Casefile flags every time someone in your network already works where you're applying."
          />
          <TeaserCard
            tab="See"
            heading="Your funnel, visualized"
            body="A flow chart of every application you've sent — where they stall, where they convert, where they ghost."
          />
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Recruiting season doesn&apos;t wait. Neither should your tracker.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-ink-soft">
          Free for the daily loop — the feed, the tracker, the network. No
          credit card.
        </p>
        <div className="mt-8">
          <Link href="/sign-up" className={CTA_CLASS}>
            Start tracking — free
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-xs text-ink-soft">
        <span>Casefile — built for the grind, not the funding round.</span>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-ink hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink hover:underline">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
