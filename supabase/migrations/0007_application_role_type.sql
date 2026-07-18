-- Lets applications be filtered the same way postings are (role type,
-- PhD), independent of whether they're linked to a scraped posting —
-- manual entries need this classified too, not just feed-sourced ones.
alter table applications add column role_type text;
alter table applications add column is_phd boolean not null default false;
