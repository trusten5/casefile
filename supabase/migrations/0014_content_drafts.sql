-- Syncs the local content engine's daily draft (see scripts/content-engine/)
-- with the /admin/content page so it can be reviewed/edited from the live
-- app, not just by hand-editing draft.json on the machine that generates it.
-- Only ever touched via the service-role key (the local scripts, and the
-- isAdmin()-gated /admin/content page's server actions) — no public
-- policies, matching the safe-by-default posture of every other table here.
create table content_drafts (
  batch_date date primary key,
  drafts jsonb not null,
  edited boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table content_drafts enable row level security;
