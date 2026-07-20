-- supabase/migrations/0015_subscriptions_and_digest.sql
-- Paid-tier entitlements. No row = free tier; only paid subscribers get
-- one. Never queried from a client component (only getUserTier via the
-- service-role client), so no RLS needed.
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  tier text not null check (tier in ('plus', 'pro')),
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_stripe_customer_id_idx on subscriptions (stripe_customer_id);

-- Email digest preferences, extending the existing per-user preferences row.
alter table user_preferences
  add column digest_enabled boolean not null default false,
  add column digest_cadence text not null default 'daily' check (digest_cadence in ('daily', 'weekly')),
  add column digest_last_sent_at timestamptz;
