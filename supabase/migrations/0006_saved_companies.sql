create table saved_companies (
  user_id text not null,
  company_id uuid not null references companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- Hand-curated "well known" companies for the Popular Companies shelf —
-- not derived from usage data since we don't have enough of it yet to be a
-- meaningful signal (see saved_companies, which will be the real signal
-- once usage grows).
alter table companies add column is_notable boolean not null default false;

update companies set is_notable = true
where slug in (
  'stripe', 'anthropic', 'airbnb', 'spacex', 'coinbase', 'cloudflare', 'figma',
  'databricks', 'palantir', 'doordash', 'instacart', 'reddit', 'discord',
  'mongodb', 'datadog', 'vercel', 'duolingo', 'robinhood', 'twitch', 'spotify'
);
