-- Stores the daily curated-feed text (headlines/tweets, source material for
-- a manual meme/joke post) alongside the pillar drafts, so /admin/content
-- can show it too, not just the emailed review.md.
alter table content_drafts add column curated_feed text;
