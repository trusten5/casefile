import { NextRequest, NextResponse } from "next/server";
import { syncAllPostings } from "@/lib/scrapers/sync";
import { syncCommunityListings } from "@/lib/scrapers/community";
import { checkStaleLinks } from "@/lib/scrapers/linkcheck";
import { getSupabase } from "@/lib/supabase";
import { isValidCronRequest } from "@/lib/cronAuth";

// Scraping ~100+ companies plus link-health checks can run past the
// platform's default function timeout — cap set to the Hobby-tier ceiling.
export const maxDuration = 60;

// Vercel Cron (see vercel.json) invokes this via GET, automatically adding
// `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set in the
// project's environment variables. POST is kept for manual/local triggering
// with the same header.
async function runSync(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const startedAt = new Date().toISOString();

  // Inserted before the run (not only after it finishes) so a hard Vercel
  // timeout kill still leaves a "started, never finished" row visible in
  // /admin/reports instead of no trace of the run at all.
  const { data: runRow, error: insertError } = await supabase
    .from("sync_runs")
    .insert({ started_at: startedAt })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const [results, community, linkHealth] = await Promise.all([
    syncAllPostings().catch((err) => [{ error: err.message }]),
    syncCommunityListings().catch((err) => ({ source: "community:vanshb03", error: err.message })),
    checkStaleLinks().catch((err) => ({ error: err.message })),
  ]);

  await supabase
    .from("sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      companies_ok: results.filter((r) => !("error" in r)).length,
      companies_failed: results.filter((r) => "error" in r).length,
      community_synced: "synced" in community ? community.synced : null,
      link_checked: "checked" in linkHealth ? linkHealth.checked : null,
      link_dead: "dead" in linkHealth ? linkHealth.dead : null,
    })
    .eq("id", runRow.id);

  return NextResponse.json({ results, community, linkHealth });
}

export const GET = runSync;
export const POST = runSync;
