# Networking revamp — design

## Scope

Build out the Contacts/networking tracker on top of the schema that already
exists (`contacts`, `interactions` — unused until now), plus a referral
cross-reference that surfaces contacts at companies you're looking at.

Explicitly out of scope for this round (decided during brainstorming):
- No LinkedIn scraping or automated people-discovery. LinkedIn has no public
  people-search API and blocks scraping — not worth the ToS risk for a
  feature that's really about organizing contacts you already have.
- No inbound-email auto-capture. `/api/inbound-email` stays a stub. Wiring
  Postmark → Groq → contacts/interactions is a distinct, sizable piece
  (webhook auth, prompt design, confidence thresholds, review-queue UI) that
  deserves its own design once the manual tracker's data model is proven out.
- No contact edit/delete UI. Wasn't a stated requirement; cheap to add later.

No migration needed — `contacts` (name, company_id, role, how_met,
linkedin_url) and `interactions` (contact_id, type enum, notes,
follow_up_date, occurred_at) already have everything this needs.

## 1. `/contacts` — list page

- Inline "Add contact" form, same pattern as the Applications page's manual
  entry form: name, company (free-text, resolved via the existing
  `findOrCreateCompany` helper so it lands on the same `companies` row
  postings/applications use), role, how met, LinkedIn URL.
- Filters mirroring `ApplicationFilters`/`CompanyDirectory` conventions:
  search by name/company (debounced), sort by name (default) or soonest
  upcoming follow-up.
- Each row: initials-avatar (same visual language as `CompanyLogo`'s
  fallback state — a circle with the first letter), name, company (linked to
  `/companies/[slug]`), role, and a small badge if there's an upcoming
  follow-up. Row links to `/contacts/[id]`.

## 2. `/contacts/[id]` — contact detail page

- Header: name, company (linked), role, how met, LinkedIn link (external,
  new tab).
- "Log interaction" form: type (coffee_chat/email/event/referral/other),
  notes, date occurred, optional follow-up date.
- Interaction history below, newest first.

## 3. Referral cross-reference

- Company detail page (`/companies/[slug]`): a "People you know here"
  section listing the current user's contacts at that company.
- Company directory cards (`CompanyDirectory.tsx`): a small contact-count
  badge when the user has a contact there.
- Computed the same way the postings chart already does it: fetch the
  current user's contacts once (small — a personal contact list, not the
  20k-posting case that needed pagination), reduce into a
  `company_id → contacts[]` map in JS, no new query per company.

## 4. Dashboard

- Replace the "Your network" placeholder section with a real "Upcoming
  follow-ups" widget, same shape as the existing "Latest postings" widget:
  lists interactions (joined to contacts, scoped to the current user) with a
  `follow_up_date` due soon, linking to the contact.

## Known v1 limitations

- No "mark follow-up done" flag. Logging a fresh interaction with a contact
  doesn't retire the old follow-up date — it just sits in the table. The
  dashboard widget query should reasonably bound what counts as "upcoming"
  (e.g. not showing something that's been overdue for months), but a real
  `resolved_at`/boolean flag is the correct fix if this becomes annoying in
  practice — deferred until it's actually a problem (small migration).
- Company-cross-reference and dashboard follow-ups are scoped to
  `contacts.user_id` — every user only sees their own contacts, consistent
  with how `saved_postings`/`saved_companies`/`applications` already work.
