import type { SupabaseClient } from "@supabase/supabase-js";

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Shared by the scraper sync (companies come with a known slug) and manual
// application entry (companies come only as free-typed names) — both need
// the same "find the canonical row or create it" behavior.
export async function findOrCreateCompany(
  supabase: SupabaseClient,
  { name, slug, logoUrl }: { name: string; slug?: string; logoUrl?: string }
) {
  const row: { name: string; slug: string; logo_url?: string } = {
    name,
    slug: slug ?? slugify(name),
  };
  // Only set when provided — omitting the key (vs. passing null) means the
  // upsert's ON CONFLICT UPDATE leaves an existing logo_url untouched, so
  // manual application entry (no known domain) can't clobber a scraped logo.
  if (logoUrl) row.logo_url = logoUrl;

  const { data, error } = await supabase
    .from("companies")
    .upsert(row, { onConflict: "slug" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

// Supabase returns embedded to-one relations as an object normally, but as an
// array when the query can't prove uniqueness — callers just want one field.
type CompanyRef =
  | { name: string; logo_url?: string | null; slug?: string | null }
  | { name: string; logo_url?: string | null; slug?: string | null }[]
  | null;

function resolveCompany(company: CompanyRef) {
  return Array.isArray(company) ? company[0] : company;
}

export function companyDisplayName(company: CompanyRef) {
  return resolveCompany(company)?.name ?? "Unknown company";
}

export function companyLogoUrl(company: CompanyRef): string | null {
  return resolveCompany(company)?.logo_url ?? null;
}

export function companySlug(company: CompanyRef): string | null {
  return resolveCompany(company)?.slug ?? null;
}
