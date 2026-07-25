-- Enables RLS on the original core tables. This was applied to the main
-- Supabase project by hand at some point (not through any migration file),
-- so dev never got it and the repo had no record of it happening at all.
-- No policies needed — every one of these tables is only ever touched via
-- the service-role key (Clerk handles auth, not Supabase Auth), matching
-- the safe-by-default posture already used for subscriptions/content_drafts.
alter table companies enable row level security;
alter table postings enable row level security;
alter table saved_postings enable row level security;
alter table applications enable row level security;
alter table status_history enable row level security;
alter table contacts enable row level security;
alter table interactions enable row level security;
alter table inbound_emails enable row level security;
alter table saved_companies enable row level security;
