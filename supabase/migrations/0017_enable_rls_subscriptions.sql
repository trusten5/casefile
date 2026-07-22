-- Only ever touched via the service-role key (getSupabase()), matching the
-- safe-by-default posture of every other table here — no public policies
-- needed since Clerk (not Supabase Auth) handles auth.
alter table subscriptions enable row level security;
