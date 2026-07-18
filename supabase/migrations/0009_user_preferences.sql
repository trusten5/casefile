-- Per-user app preferences (not Clerk account identity — that's handled by
-- Clerk itself) and named/saved search filter presets.
create table user_preferences (
  user_id text primary key,
  daily_goal integer not null default 1,
  school text,
  major text,
  experience text,
  resume_url text,
  cover_letter_url text,
  updated_at timestamptz not null default now()
);

-- Filter fields default to '' (not null) so reading them stays the exact
-- same truthy-string pattern every filter query already uses
-- (`if (company) query = query.ilike(...)`), no new null-handling branch.
create table saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  scope text not null, -- 'feed' | 'applications'
  name text not null,
  company text not null default '',
  role_type text not null default '',
  location text not null default '',
  keyword text not null default '',
  level text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index saved_filters_user_id_idx on saved_filters (user_id);
