import { getSupabase } from "@/lib/supabase";
import { findOrCreateCompany } from "@/lib/companies";
import { pool } from "@/lib/pool";
import { fetchGreenhousePostings } from "./greenhouse";
import { fetchLeverPostings } from "./lever";
import { fetchAshbyPostings } from "./ashby";
import { SEED_COMPANIES } from "./companies";
import type { SeedCompany } from "./types";

async function fetchForCompany(ats: SeedCompany["ats"], boardToken: string) {
  if (ats === "greenhouse") return fetchGreenhousePostings(boardToken);
  if (ats === "lever") return fetchLeverPostings(boardToken);
  return fetchAshbyPostings(boardToken);
}

async function syncCompany(company: SeedCompany) {
  const supabase = getSupabase();
  try {
    const companyId = await findOrCreateCompany(supabase, {
      name: company.name,
      slug: company.slug,
      logoUrl: company.domain ? `https://icons.duckduckgo.com/ip3/${company.domain}.ico` : undefined,
    });
    const postings = await fetchForCompany(company.ats, company.boardToken);

    const rows = postings.map((p) => ({
      company_id: companyId,
      title: p.title,
      location: p.location,
      role_type: p.roleType,
      url: p.url,
      source: company.ats,
      is_active: true,
      posted_at: p.postedAt,
      is_phd: p.isPhd,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from("postings").upsert(rows, { onConflict: "url" });
      if (error) throw error;
    }

    // Postings that were active for this company but didn't show up in this
    // fetch have been pulled down or expired — mark them inactive rather
    // than deleting, so saved/applied history stays intact.
    const { data: existing, error: existingError } = await supabase
      .from("postings")
      .select("id, url")
      .eq("company_id", companyId)
      .eq("is_active", true);
    if (existingError) throw existingError;

    const freshUrls = new Set(rows.map((r) => r.url));
    const staleIds = (existing ?? [])
      .filter((row) => !freshUrls.has(row.url))
      .map((row) => row.id);

    if (staleIds.length > 0) {
      const { error: staleError } = await supabase
        .from("postings")
        .update({ is_active: false })
        .in("id", staleIds);
      if (staleError) throw staleError;
    }

    return { company: company.name, synced: rows.length, deactivated: staleIds.length };
  } catch (err) {
    return { company: company.name, error: (err as Error).message };
  }
}

// Sequential (one request at a time) would take many minutes at this
// company count — a small worker pool keeps it to roughly (n / concurrency)
// request round-trips instead of n.
// ponytail: bumped 8->16 alongside the company list crossing 200 to hold
// wall-clock roughly flat against the 60s function cap — each target is a
// different host (its own ATS's API), so raising this doesn't concentrate
// load on any one of them. Bump again (or split into two cron-triggered
// batches) if the company list keeps growing and runs start timing out.
export async function syncAllPostings() {
  return pool(SEED_COMPANIES, 16, syncCompany);
}
