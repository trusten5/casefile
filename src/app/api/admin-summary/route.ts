import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isValidCronRequest } from "@/lib/cronAuth";

// Read-only summary for external automation (e.g. a scheduled digest) that
// shouldn't have full database access — gated by the same CRON_SECRET
// already used for /api/sync-postings, not the Supabase service-role key.
export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  const [{ data: latestSync }, { count: pendingBrokenLinkReports }, { count: totalActivePostings }] =
    await Promise.all([
      supabase
        .from("sync_runs")
        .select(
          "started_at, finished_at, companies_ok, companies_failed, community_synced, link_checked, link_dead, error"
        )
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("postings")
        .select("id", { count: "exact", head: true })
        .not("reported_broken_at", "is", null)
        .eq("is_active", true),
      supabase.from("postings").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

  return NextResponse.json({
    latestSync,
    pendingBrokenLinkReports: pendingBrokenLinkReports ?? 0,
    totalActivePostings: totalActivePostings ?? 0,
  });
}
