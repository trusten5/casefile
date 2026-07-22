-- Freeform feature requests submitted from /profile. No status workflow
-- beyond is_read — admin reviews at /admin/feature-requests. Only ever
-- touched via the service-role key, matching every other table here.
create table feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table feature_requests enable row level security;
