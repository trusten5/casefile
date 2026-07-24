import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { syncAllPostings } from "@/lib/scrapers/sync";
import { syncCommunityListings } from "@/lib/scrapers/community";
import { checkStaleLinks } from "@/lib/scrapers/linkcheck";
import { getSupabase } from "@/lib/supabase";

// Scraping ~100+ companies plus link-health checks can run past the
// platform's default function timeout — cap set to the Hobby-tier ceiling.
export const maxDuration = 60;

// Vercel Cron (see vercel.json) invokes this via GET, automatically adding
// `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set in the
// project's environment variables. POST is kept for manual/local triggering
// with the same header.
async function runSync(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const [results, community, linkHealth] = await Promise.all([
    syncAllPostings().catch((err) => [{ error: err.message }]),
    syncCommunityListings().catch((err) => ({ source: "community:vanshb03", error: err.message })),
    checkStaleLinks().catch((err) => ({ error: err.message })),
  ]);

  // Logged here (not inferred from postings timestamps) so cron health is
  // directly observable in /admin/reports even if a run partially fails.
  const supabase = getSupabase();
  await supabase.from("sync_runs").insert({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    companies_ok: results.filter((r) => !("error" in r)).length,
    companies_failed: results.filter((r) => "error" in r).length,
    community_synced: "synced" in community ? community.synced : null,
    link_checked: "checked" in linkHealth ? linkHealth.checked : null,
    link_dead: "dead" in linkHealth ? linkHealth.dead : null,
  });

  // Invalidates /companies' cached postings scan right away instead of
  // leaving it to the 1hr fallback revalidate — so a sync landing new
  // postings shows up on the next page load, not up to an hour later.
  // "max" = stale-while-revalidate: this request's own page loads still get
  // today's now-stale cache, but the *next* /companies visit after this
  // returns triggers a fresh scan instead of waiting out the hour.
  revalidateTag("postings", "max");

  return NextResponse.json({ results, community, linkHealth });
}

export const GET = runSync;
export const POST = runSync;
