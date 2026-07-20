# Monetization — design

## Scope

Two additive paid tiers on top of the current fully-free app — nothing that's
free today moves behind a paywall.

- **Plus, $1.99/mo** (or $19/yr) — email digest of new postings matching a
  user's saved feed filter.
- **Pro, $9.99/mo** (or $99/yr) — everything in Plus, plus AI-parsed inbound
  application-status emails (finishing the Postmark→Groq pipeline that
  `2026-07-18-networking-revamp-design.md` explicitly deferred).

Billing is Stripe (Checkout + Customer Portal, both hosted — no custom
payment UI). Explicitly out of scope for this round:
- Any AI feature beyond inbound-email parsing (resume feedback, job-match
  scoring, chat) — Pro is scoped to the one feature already half-built.
- A message queue / job system for email sending — see "Digest send
  mechanism" below for why a batch API call is enough.
- A full RLS migration — see "Pre-launch fixes" for the cheaper substitute.
- Per-user custom pricing, trials, or coupons — flat pricing, no promo logic.

## Pre-launch fixes

Found during audit, ordered by how much they matter once real money and a
bigger feature surface are involved:

1. **Cross-user data-access test.** Every table's authorization today is a
   hand-written `.eq("user_id", ...)` filter in server actions — no RLS,
   service-role client bypasses RLS even where it exists. All checked out
   correct today, but nothing stops a future PR from missing one. Add one
   test file that, as user A, attempts every read/write path (`applications`,
   `contacts`, `interactions`, `saved_postings`, `saved_companies`,
   `user_preferences`, `saved_filters`) and asserts user B's rows are
   unreachable. Cheaper than a full RLS rollout and catches regressions going
   forward — including in the new `subscriptions` table this design adds.
2. **Make `applyFromPosting` atomic.** `feed/actions.ts` inserts into
   `applications` then `status_history` as two unwrapped calls. Wrap both in
   a Postgres function (`create_application_with_history(...)`) called via
   `supabase.rpc()`, so a partial failure can't leave an orphaned
   application that silently disappears from the funnel chart.
3. **Make sync-cron failures visible.** `/api/sync-postings` only writes a
   `sync_runs` row after `Promise.all` resolves — a Vercel timeout kill
   leaves no trace. Wrap the run body in `try/finally` so a `sync_runs` row
   (marked `error: "timeout or crash"`) is written even on an uncaught
   failure.

Not blocking launch, but cheap enough to fold into the same pass:
timing-safe compare for `CRON_SECRET` (`crypto.timingSafeEqual`), and a
shared `try/catch → flash message` wrapper for server actions instead of
bare `throw` (matters more once a failed write might be billing-adjacent).

## Data model

```sql
-- New table
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,               -- Clerk user id, same convention as every other table
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  tier text not null check (tier in ('plus', 'pro')),
  status text not null,                        -- active | past_due | canceled | incomplete | trialing
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No row = free tier. Only paid subscribers get a row. RLS not required
-- (service-role-only table, never queried from the client).

-- Extend user_preferences (already exists)
alter table user_preferences
  add column digest_enabled boolean not null default false,
  add column digest_cadence text not null default 'daily' check (digest_cadence in ('daily', 'weekly')),
  add column digest_last_sent_at timestamptz;
```

`getUserTier(userId)` in `src/lib/subscriptions.ts` — one query, one place
every feature gate calls: returns `'free' | 'plus' | 'pro'` from the
`subscriptions` row's `tier` if `status = 'active'` (or `'trialing'`),
else `'free'`. Every other part of the app (digest toggle in `/profile`,
inbound-email forwarding address, upgrade CTAs) calls this one helper —
no scattered Stripe lookups.

## Billing integration

- **Stripe Checkout** (hosted), not Stripe Elements — Stripe owns PCI
  compliance and the Customer Portal (cancel/upgrade/update card) comes
  free, no UI to build for either.
- Two Stripe Products (Plus, Pro), each with a monthly and annual Price —
  four Price IDs total, stored as env vars (`STRIPE_PRICE_PLUS_MONTHLY`,
  `STRIPE_PRICE_PLUS_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`,
  `STRIPE_PRICE_PRO_ANNUAL`) and mapped to `tier` in the webhook handler.
- New public route `/pricing` — static pricing cards, "Upgrade" buttons post
  to a server action (`createCheckoutSession`) that calls
  `stripe.checkout.sessions.create(...)` with the right price ID and
  redirects to Stripe. Success/cancel both redirect back into the app with a
  `?flash=` param, reusing the existing `Flash` component.
- `/profile` gets a "Manage subscription" link once a user has a
  `subscriptions` row — a server action creates a Stripe Billing Portal
  session and redirects there. No custom cancel/upgrade UI needed.
- `/api/webhooks/stripe` — same shape as the existing
  `/api/webhooks/clerk` handler (verify signature, switch on event type):
  - `checkout.session.completed` → upsert the `subscriptions` row (tier from
    price ID, `status: 'active'`).
  - `customer.subscription.updated` → sync `status`/`tier`/
    `current_period_end` (covers renewals, upgrades, downgrades, and
    Stripe's own dunning retries on `past_due`).
  - `customer.subscription.deleted` → set `status: 'canceled'`
    (`getUserTier` already treats anything non-active as free — no row
    deletion needed, keeps the record for support/history).

## Tier 1 — digest email

Reuses the existing saved-filters feature — no new discovery logic.

- A user enables the digest in `/profile` (gated: only shown if
  `getUserTier` returns `plus` or `pro`) by picking daily/weekly cadence.
  Enabling it requires having a **default saved filter** on the `feed`
  scope already set (existing feature) — if none exists, the toggle prompts
  the user to set one first. This avoids designing a second filter picker
  just for digests.
- New cron `/api/send-digests`, `vercel.json` schedule `0 14 * * *` (after
  the existing sync). Vercel Hobby allows 2 cron jobs at 1x/day each — this
  fits alongside `sync-postings` with no plan upgrade.
- Handler logic: select all `user_preferences` rows where `digest_enabled`
  and tier is plus/pro, and cadence is `daily` OR (`weekly` AND today is
  Monday — a fixed day, not a per-user signup-anniversary day, to keep the
  query simple). For each, run their default filter's query
  (`applyPostingFilters`, already exists) with `posted_at > digest_last_sent_at`,
  capped at 20 results.
- **Send mechanism — the scalability audit's key finding**: do not loop one
  Postmark API call per subscriber inside the cron function; that's what
  times out as subscribers grow. Use Postmark's **batch endpoint**
  (`/email/batch`, up to 500 messages per call), chunking subscriber batches
  through the existing `src/lib/pool.ts` worker-pool pattern. No queue
  system needed at this volume.
- Skip (don't email, don't touch the watermark) any subscriber with zero new
  postings since their last send. On successful send, update
  `digest_last_sent_at`.

## Tier 2 — AI inbound-email tracking

Finishes `/api/inbound-email` (currently a 501 stub) using the
`inbound_emails` table and `GROQ_API_KEY` env var that already exist,
scaffolded for exactly this.

- **Identifying the user without per-user mailbox provisioning**: one shared
  Postmark inbound address (e.g. `intake@inbound.casefile.site`); each Pro
  user's forwarding instructions use Postmark's `+`-addressing
  (`intake+<user_id>@inbound.casefile.site`). Postmark's inbound webhook
  payload includes `MailboxHash` (the part after `+`), which is the
  `user_id` — no per-user mailbox setup, one inbound server for everyone.
  Gated: the forwarding address is only shown in `/profile` if
  `getUserTier` returns `pro`; the webhook handler drops (and does not
  store) any inbound email whose `MailboxHash` doesn't resolve to a `pro`
  user, so a lapsed subscriber's old address stops working immediately.
- **Classification**: forward subject + body to Groq with a structured
  output schema — `{ company_name, role_title, event_type: interview_invite
  | rejection | offer | oa_request | other, confidence: 0-1 }`. Match
  `company_name` against the existing `companies` table using the
  `aliases[]` column (already populated for exactly this kind of fuzzy
  matching, currently only used for scraper company resolution).
- **Confidence routing**: if `confidence >= 0.75` and the matched
  company+role resolves to exactly one of the user's open `applications`
  rows, auto-append a `status_history` row and update the application's
  `status` — same code path `updateApplicationStatus` already uses, so the
  Sankey funnel and dashboard counts stay correct automatically. Otherwise,
  insert into `inbound_emails` with `review_status: 'pending'`.
- **Review queue UI**: a new "Review" section on `/applications` (not
  `/admin` — this is per-user, not admin) listing the current user's
  pending `inbound_emails` rows with "Confirm" / "Dismiss" actions, mirroring
  the exact pattern `admin/actions.ts` already uses for broken-link reports
  (`confirmBroken` / `dismissReport`).
- Cost note: Groq's per-parse cost is fractions of a cent even on heavy use
  — the cost driver for this tier is Postmark inbound email volume, not AI,
  so margin stays wide as usage grows.

## Pricing & margin

Infrastructure cost is near-zero at current scale (Vercel Hobby, Supabase
free tier, Postmark's free allowance) — the real margin question is Stripe's
2.9% + $0.30 per charge: ~18% of revenue on a $1.99 monthly charge, ~6% on
$9.99. **Default the pricing page to annual billing** ($19/yr Plus — ~20% off the
$23.88/yr monthly-equivalent; $99/yr Pro — ~17% off $119.88/yr) as the
primary CTA, monthly as the secondary option: one Stripe charge per year
instead of 12 cuts the fee drag roughly 12x and reduces involuntary churn
from expired cards.

## Phased rollout

1. **Pre-launch fixes** (above) — bounded, done before Stripe touches a
   real card.
2. **Plus launch** — `subscriptions` table, Stripe integration
   (Checkout/Portal/webhook), `/pricing`, digest cron. Revenue starts here;
   validates willingness-to-pay before building the harder tier.
3. **Pro launch** — finish the inbound-email pipeline, gate behind Pro.
   Monitor Groq + Postmark cost per active Pro user for the first month to
   confirm the margin assumption above holds in practice.
4. **Before spending on distribution** (e.g. the TikTok plan from earlier):
   add basic funnel event tracking (free → Plus, free → Pro, cancellations)
   — GA4 today is page-views only, with zero custom events, so there's
   currently no way to tell whether an acquisition channel converts.

## Testing

Per the audit's test-gap finding (zero tests exist anywhere today), the
first tests added should be the ones this design makes load-bearing:

- The cross-user access test (pre-launch fix #1) — covers every table,
  including the new `subscriptions` table.
- `getUserTier` — unit test against each `status`/`tier` combination
  (active, past_due, canceled, no row).
- Stripe webhook handler — test each event type against a fixture payload,
  asserting the `subscriptions` row lands in the expected state; this is the
  one integration point where a silent bug directly costs or loses revenue.
- Digest cron's filter-to-postings query and the skip-if-no-new-postings
  logic (pure function, no Postmark call needed to test it).
