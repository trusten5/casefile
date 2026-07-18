-- Company logo, sourced from Clearbit's logo API keyed off each company's
-- domain (set at scrape/seed time) — see src/lib/scrapers/companies.ts.
alter table companies add column logo_url text;
