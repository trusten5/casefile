import { getSupabase } from "@/lib/supabase";
import { findOrCreateCompany } from "@/lib/companies";
import { inferRoleType, isPhdRole } from "./types";

// Community-maintained listing feed — covers ATS types we don't have adapters
// for (Rippling, Ashby, Workday, direct career sites) by consuming its
// already-normalized JSON instead of scraping each of those ourselves.
const LISTINGS_URL =
  "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/.github/scripts/listings.json";

type CommunityListing = {
  id: string;
  company_name: string;
  title: string;
  url: string;
  locations: string[];
  date_posted: number;
  active: boolean;
  is_visible: boolean;
};

export async function syncCommunityListings() {
  const supabase = getSupabase();

  const res = await fetch(LISTINGS_URL, { next: { revalidate: 0 }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Community listings fetch returned ${res.status}`);
  const listings = (await res.json()) as CommunityListing[];

  const usable = listings.filter((l) => l.active && l.is_visible && l.company_name && l.url && l.title);

  // Resolve each unique company once instead of once per listing — several
  // listings usually share the same company.
  const companyIds = new Map<string, string>();
  for (const name of new Set(usable.map((l) => l.company_name))) {
    companyIds.set(name, await findOrCreateCompany(supabase, { name }));
  }

  const rows = usable.map((l) => ({
    company_id: companyIds.get(l.company_name)!,
    title: l.title,
    location: l.locations?.join(", ") || null,
    role_type: inferRoleType(l.title),
    url: l.url,
    source: "community:vanshb03",
    is_active: true,
    posted_at: new Date(l.date_posted * 1000).toISOString(),
    is_phd: isPhdRole(l.title),
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("postings").upsert(rows, { onConflict: "url" });
    if (error) throw error;
  }

  // Same stale-detection the ATS sync does: a listing that dropped out of
  // this fetch (closed, or the upstream list itself caught up to reality)
  // shouldn't stay marked active forever just because we never re-check it.
  const { data: existing, error: existingError } = await supabase
    .from("postings")
    .select("id, url")
    .eq("source", "community:vanshb03")
    .eq("is_active", true);
  if (existingError) throw existingError;

  const freshUrls = new Set(rows.map((r) => r.url));
  const staleIds = (existing ?? []).filter((row) => !freshUrls.has(row.url)).map((row) => row.id);

  if (staleIds.length > 0) {
    const { error: staleError } = await supabase
      .from("postings")
      .update({ is_active: false })
      .in("id", staleIds);
    if (staleError) throw staleError;
  }

  return { source: "community:vanshb03", companies: companyIds.size, synced: rows.length, deactivated: staleIds.length };
}
