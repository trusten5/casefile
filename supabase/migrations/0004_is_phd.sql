-- Title-keyword flag for PhD/doctoral roles, so the feed can filter them out.
alter table postings add column is_phd boolean not null default false;
