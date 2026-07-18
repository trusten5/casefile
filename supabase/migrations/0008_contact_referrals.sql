-- Contact referrals — who introduced you to whom, plus a fixed category for
-- contacts with no specific referrer. Together these let the network tree
-- root at a small set of categories (alumni, past job, etc.) and branch into
-- specific-contact referral chains (A introduced you to B introduced you to C).
create type how_met_category as enum ('alumni', 'past_job', 'cold_outreach', 'event', 'referral', 'other');

alter table contacts
  add column how_met_category how_met_category not null default 'other',
  add column referred_by_contact_id uuid references contacts (id) on delete set null;
