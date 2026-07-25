-- Backfilled from main: this table existed on the main Supabase project
-- with no corresponding migration file anywhere in the repo.
-- Only ever touched via the service-role key (/admin feature-request inbox),
-- matching the safe-by-default posture of every other table here.
create table feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table feature_requests enable row level security;
