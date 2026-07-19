-- Pre-aggregated per-ATS-source stats for the admin scraping-stats section —
-- avoids pulling all 20k+ postings rows client-side just to count/group them.
create view source_stats as
select
  source,
  count(*) filter (where is_active) as active_postings,
  count(distinct company_id) as companies
from postings
group by source;

-- Views default to SECURITY DEFINER-like behavior (runs as the view owner,
-- bypassing the querying role's RLS) — flagged as an ERROR by the Supabase
-- linter. Not exploitable today (this app only queries via the service-role
-- key, which already bypasses RLS regardless), but matches the safe-by-
-- default posture of every other table.
alter view source_stats set (security_invoker = true);
