-- Logs each /api/sync-postings invocation (cron or manual) so cron health
-- is observable directly instead of inferred from postings timestamps.
create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  finished_at timestamptz,
  companies_ok int,
  companies_failed int,
  community_synced int,
  link_checked int,
  link_dead int,
  error text
);

create index sync_runs_started_at_idx on sync_runs (started_at desc);

alter table sync_runs enable row level security;
