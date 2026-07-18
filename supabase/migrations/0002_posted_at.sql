-- Adds the actual "date posted" from the source ATS, separate from
-- first_seen_at (when our scraper discovered it). Feed/dashboard sort and
-- display by this, not by discovery time.
alter table postings add column posted_at timestamptz;
update postings set posted_at = first_seen_at where posted_at is null;
alter table postings alter column posted_at set not null;
alter table postings alter column posted_at set default now();
