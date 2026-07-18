-- Feed/dashboard queries filter on is_active + reported_broken_at and sort
-- by posted_at on every load; saved_postings/saved_companies are looked up
-- by user_id on every feed/companies page render. None were indexed.
create index if not exists postings_active_posted_at_idx
  on postings (is_active, posted_at desc);

create index if not exists postings_reported_broken_at_idx
  on postings (reported_broken_at);

create index if not exists saved_postings_user_id_idx
  on saved_postings (user_id);

create index if not exists saved_companies_user_id_idx
  on saved_companies (user_id);

-- Foreign keys without a covering index (flagged by the Supabase advisor).
create index if not exists applications_company_id_idx
  on applications (company_id);

create index if not exists applications_posting_id_idx
  on applications (posting_id);

create index if not exists contacts_company_id_idx
  on contacts (company_id);

create index if not exists contacts_referred_by_contact_id_idx
  on contacts (referred_by_contact_id);

create index if not exists interactions_contact_id_idx
  on interactions (contact_id);

create index if not exists saved_companies_company_id_idx
  on saved_companies (company_id);

create index if not exists saved_postings_posting_id_idx
  on saved_postings (posting_id);
