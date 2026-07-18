-- Tracks link-health separately from is_active so an automated check and a
-- user report can't silently get clobbered by the next sync's upsert.
alter table postings add column link_checked_at timestamptz;
alter table postings add column reported_broken_at timestamptz;
