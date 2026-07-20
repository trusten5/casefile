-- supabase/migrations/0014_atomic_application_insert.sql
-- Wraps the applications + status_history insert pair in one transaction
-- (a plpgsql function body is transactional) so a failure on the second
-- insert can't leave an orphaned application that silently disappears from
-- the funnel chart (getApplicationFlow skips zero-history applications).
create or replace function create_application_with_history(
  p_user_id text,
  p_company_id uuid,
  p_posting_id uuid,
  p_role_title text,
  p_role_type text,
  p_is_phd boolean,
  p_status text default 'applied',
  p_source text default 'feed'
) returns uuid
language plpgsql
as $$
declare
  v_application_id uuid;
begin
  insert into applications (user_id, company_id, posting_id, role_title, status, source, role_type, is_phd)
  values (p_user_id, p_company_id, p_posting_id, p_role_title, p_status::application_status, p_source, p_role_type, p_is_phd)
  returning id into v_application_id;

  insert into status_history (application_id, status)
  values (v_application_id, p_status::application_status);

  return v_application_id;
end;
$$;
