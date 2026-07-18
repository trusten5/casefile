-- Internship Hub — Phase 0 schema.
-- user_id / contact ownership columns store the Clerk user id (text), not a
-- Supabase auth uid — auth is handled by Clerk, Supabase is just Postgres here.

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table postings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  title text not null,
  location text,
  role_type text,
  url text not null unique,
  source text not null,
  first_seen_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table saved_postings (
  user_id text not null,
  posting_id uuid not null references postings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, posting_id)
);

create type application_status as enum (
  'applied', 'oa', 'interview', 'offer', 'rejected', 'ghosted'
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  company_id uuid not null references companies (id),
  posting_id uuid references postings (id),
  role_title text not null,
  status application_status not null default 'applied',
  applied_at timestamptz not null default now(),
  source text not null default 'manual'
);

create table status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  status application_status not null,
  changed_at timestamptz not null default now(),
  source_email_id uuid
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  company_id uuid references companies (id),
  role text,
  how_met text,
  linkedin_url text,
  created_at timestamptz not null default now()
);

create type interaction_type as enum ('coffee_chat', 'email', 'event', 'referral', 'other');

create table interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  type interaction_type not null default 'other',
  notes text,
  follow_up_date date,
  occurred_at timestamptz not null default now()
);

create type review_status as enum ('pending', 'accepted', 'rejected');

create table inbound_emails (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  raw_text text not null,
  parsed_json jsonb,
  confidence numeric,
  review_status review_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index applications_user_id_idx on applications (user_id);
create index contacts_user_id_idx on contacts (user_id);
create index postings_company_id_idx on postings (company_id);
create index status_history_application_id_idx on status_history (application_id);
