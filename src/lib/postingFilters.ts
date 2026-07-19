export type PostingFilters = {
  company: string;
  roleType: string;
  location: string;
  keyword: string;
  level: string;
};

// Shared between the landing-page teaser and /feed so both filter postings
// identically — relies on the caller's query already joining company with
// `!inner` (that's what makes `company.name` filterable here). Generic (not
// `any`) so the caller's specific row type survives the chain — the postings
// select shape differs slightly wherever this is called from.
export function applyPostingFilters<
  Q extends {
    ilike(column: string, pattern: string): Q;
    eq(column: string, value: boolean | string): Q;
  },
>(query: Q, filters: PostingFilters): Q {
  if (filters.company) query = query.ilike("company.name", `%${filters.company}%`);
  if (filters.roleType) query = query.eq("role_type", filters.roleType);
  if (filters.location) query = query.ilike("location", `%${filters.location}%`);
  if (filters.keyword) query = query.ilike("title", `%${filters.keyword}%`);
  if (filters.level === "undergrad") query = query.eq("is_phd", false);
  if (filters.level === "phd") query = query.eq("is_phd", true);
  return query;
}

export function parsePostingFilters(
  searchParams: Record<string, string | string[] | undefined>
): PostingFilters {
  return {
    company: typeof searchParams.company === "string" ? searchParams.company : "",
    roleType: typeof searchParams.roleType === "string" ? searchParams.roleType : "",
    location: typeof searchParams.location === "string" ? searchParams.location : "",
    keyword: typeof searchParams.keyword === "string" ? searchParams.keyword : "",
    level: typeof searchParams.level === "string" ? searchParams.level : "",
  };
}

export function postingFiltersToQueryString(filters: PostingFilters): string {
  const params = new URLSearchParams();
  if (filters.company) params.set("company", filters.company);
  if (filters.roleType) params.set("roleType", filters.roleType);
  if (filters.location) params.set("location", filters.location);
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.level) params.set("level", filters.level);
  return params.toString();
}
