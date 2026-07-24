import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { Flash } from "@/components/Flash";
import { Avatar } from "@/components/Avatar";
import { companyDisplayName, companySlug } from "@/lib/companies";
import { HOW_MET_CATEGORIES } from "@/lib/contacts";
import { createContact } from "./actions";
import { ContactList } from "./ContactList";
import { NetworkChart } from "./NetworkChart";
import { ContactTree, type ContactTreeNode } from "./ContactTree";

export const dynamic = "force-dynamic";

// New to networking gets the prominent callout; once you've got a handful of
// contacts going, the guide is still one click away, just not front and center.
const GUIDE_CALLOUT_THRESHOLD = 5;

function todayDateOnly() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

// Same day-snapped pattern as companies/page.tsx's daysAgoISO — a raw
// Date.now() here caused a real hydration mismatch earlier this session
// (two renders of a request landing on opposite sides of a rolling cutoff).
// Snapping to midnight means repeated calls in one request are identical.
function daysAgoISO(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

const STALE_AFTER_DAYS = 60;

type InteractionRow = { id: string; occurred_at: string; follow_up_date: string | null };
type ContactRow = {
  id: string;
  name: string;
  role: string | null;
  company_id: string | null;
  company: { name: string; slug: string } | { name: string; slug: string }[] | null;
  company_name_input: string | null;
  interactions: InteractionRow[] | null;
  how_met_category: string;
  referred_by_contact_id: string | null;
};

type NextAction = "overdue" | "neverContacted" | "stale" | null;

export default async function ContactsPage(props: PageProps<"/contacts">) {
  const { userId } = await auth();
  const searchParams = await props.searchParams;
  const flash = typeof searchParams.flash === "string" ? searchParams.flash : undefined;
  const supabase = getSupabase();

  const { data, error } = userId
    ? await supabase
        .from("contacts")
        .select(
          "id, name, role, company_id, company:companies(name, slug), company_name_input, interactions(id, occurred_at, follow_up_date), how_met_category, referred_by_contact_id"
        )
        .eq("user_id", userId)
        .order("name")
        .returns<ContactRow[]>()
    : { data: [] as ContactRow[], error: null };

  const today = todayDateOnly();
  const contacts = (data ?? []).map((c) => {
    const interactions = c.interactions ?? [];
    // Only the most recent interaction decides the next action — an old
    // dangling follow-up date from an earlier interaction stops mattering
    // once a newer one is logged.
    const sorted = [...interactions].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
    const latest = sorted[0] ?? null;

    const upcoming = interactions
      .map((i) => i.follow_up_date)
      .filter((d): d is string => Boolean(d) && d! >= today)
      .sort();
    const nextFollowUp = upcoming[0] ?? null;

    const isOverdue = Boolean(latest?.follow_up_date) && latest!.follow_up_date! < today;
    const daysSince = latest
      ? Math.floor((Date.parse(today) - Date.parse(latest.occurred_at.slice(0, 10))) / 86400000)
      : null;
    const isStale = !isOverdue && daysSince !== null && daysSince >= STALE_AFTER_DAYS;
    const isNeverContacted = sorted.length === 0;

    let nextAction: NextAction = null;
    let actionReason = "";
    if (isOverdue) {
      nextAction = "overdue";
      actionReason = `Follow-up was due ${latest!.follow_up_date}`;
    } else if (isNeverContacted) {
      nextAction = "neverContacted";
      actionReason = "Never followed up";
    } else if (isStale) {
      nextAction = "stale";
      actionReason = `Last talked ${daysSince} day${daysSince === 1 ? "" : "s"} ago`;
    }

    const slug = companySlug(c.company);
    return {
      id: c.id,
      name: c.name,
      role: c.role,
      companyId: c.company_id,
      companyName: slug ? companyDisplayName(c.company) : c.company_name_input,
      nextFollowUp,
      nextAction,
      actionReason,
      daysSince,
      followUpDate: latest?.follow_up_date ?? null,
      howMetCategory: c.how_met_category,
      referredByContactId: c.referred_by_contact_id,
    };
  });

  // Referral chains nest under the referring contact regardless of
  // category; a contact with no specific referrer roots under its "how
  // met" category instead. No cycle-guard needed — referred_by_contact_id
  // can only ever point at a contact that already existed at creation
  // time (the picker only offers existing contacts), so the chain is a DAG
  // by construction.
  const treeNodeById = new Map<string, ContactTreeNode>();
  for (const c of contacts) {
    treeNodeById.set(c.id, { id: c.id, name: c.name, role: c.role, companyName: c.companyName, children: [] });
  }
  const rootsByCategory = new Map<string, ContactTreeNode[]>();
  for (const c of contacts) {
    const node = treeNodeById.get(c.id)!;
    const parent = c.referredByContactId ? treeNodeById.get(c.referredByContactId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      const bucket = rootsByCategory.get(c.howMetCategory) ?? [];
      bucket.push(node);
      rootsByCategory.set(c.howMetCategory, bucket);
    }
  }
  const treeCategories = HOW_MET_CATEGORIES.map((cat) => ({
    value: cat.value,
    label: cat.label,
    roots: rootsByCategory.get(cat.value) ?? [],
  }));

  const overdueContacts = contacts
    .filter((c) => c.nextAction === "overdue")
    .sort((a, b) => (a.followUpDate! < b.followUpDate! ? -1 : 1));
  const neverContactedContacts = contacts
    .filter((c) => c.nextAction === "neverContacted")
    .sort((a, b) => a.name.localeCompare(b.name));
  const staleContacts = contacts
    .filter((c) => c.nextAction === "stale")
    .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));
  const actionList = [...overdueContacts, ...neverContactedContacts, ...staleContacts].slice(0, 8);

  // Companies you know people at, cross-referenced against recent postings —
  // bounded to just those companies (typically a handful), unlike the
  // Companies page's chart which paginates through every active posting.
  const companyIds = [...new Set(contacts.map((c) => c.companyId).filter((id): id is string => Boolean(id)))];
  const { data: recentPostings } = companyIds.length
    ? await supabase
        .from("postings")
        .select("company_id, posted_at")
        .in("company_id", companyIds)
        .eq("is_active", true)
        .gte("posted_at", daysAgoISO(7))
    : { data: [] as { company_id: string; posted_at: string }[] };

  const recentCountByCompany = new Map<string, number>();
  for (const p of recentPostings ?? []) {
    recentCountByCompany.set(p.company_id, (recentCountByCompany.get(p.company_id) ?? 0) + 1);
  }
  const contactCountByCompany = new Map<string, number>();
  const companyNameById = new Map<string, string>();
  for (const c of contacts) {
    if (!c.companyId) continue;
    contactCountByCompany.set(c.companyId, (contactCountByCompany.get(c.companyId) ?? 0) + 1);
    if (c.companyName) companyNameById.set(c.companyId, c.companyName);
  }
  const networkCompanies = companyIds.map((id) => ({
    id,
    name: companyNameById.get(id) ?? "Unknown company",
    recentCount: recentCountByCompany.get(id) ?? 0,
    contactCount: contactCountByCompany.get(id) ?? 0,
  }));

  return (
    <div>
      <Flash message={flash} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Contacts</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"} across {companyIds.length}{" "}
            compan{companyIds.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <Link href="/contacts/guide" className="text-sm font-medium text-ink-soft hover:text-ink">
          Networking guide →
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">Next actions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Overdue follow-ups</p>
            <p className="font-display text-xl font-semibold text-ink">{overdueContacts.length}</p>
          </div>
          <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Never followed up</p>
            <p className="font-display text-xl font-semibold text-ink">{neverContactedContacts.length}</p>
          </div>
          <div className="rounded-lg border border-paper-line bg-tab/30 px-4 py-3">
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Going stale</p>
            <p className="font-display text-xl font-semibold text-ink">{staleContacts.length}</p>
          </div>
        </div>

        {actionList.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            You&apos;re all caught up — nothing needs attention right now.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-paper-line">
            {actionList.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                <Link
                  href={`/contacts/${c.id}`}
                  className="flex min-w-0 items-center gap-3 text-sm font-medium text-ink hover:underline"
                >
                  <Avatar name={c.name} />
                  <span className="truncate">{c.name}</span>
                </Link>
                <span className="shrink-0 font-mono text-xs text-ink-soft">{c.actionReason}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">How your network connects</h2>
        <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ink-soft">
          Rooted by how you met, branching into who introduced you to whom
        </p>
        <ContactTree categories={treeCategories} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">Your network&apos;s activity</h2>
        <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ink-soft">
          Companies you know people at, by postings this week
        </p>
        <NetworkChart companies={networkCompanies} />
      </section>

      <form action={createContact} className="mt-10 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Name
          <input
            name="name"
            required
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Company
          <input
            name="companyName"
            placeholder="Optional"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Role
          <input
            name="role"
            placeholder="Optional"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          How you met
          <select
            name="howMetCategory"
            defaultValue="other"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          >
            {HOW_MET_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </label>
        {contacts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            Introduced by
            <select
              name="referredByContactId"
              defaultValue=""
              className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">Nobody in particular</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Notes
          <input
            name="howMet"
            placeholder="e.g. Career fair, mutual friend"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          LinkedIn
          <input
            name="linkedinUrl"
            placeholder="Optional"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
          Add contact
        </button>
      </form>

      {error && (
        <p className="mt-6 text-sm text-status-rejected">
          Couldn&apos;t load contacts: {error.message}
        </p>
      )}

      <ContactList
        contacts={contacts.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          companyName: c.companyName,
          nextFollowUp: c.nextFollowUp,
        }))}
      />

      {contacts.length < GUIDE_CALLOUT_THRESHOLD && (
        <div className="mt-10 rounded-xl border border-dashed border-paper-line p-6 text-center">
          <p className="text-sm text-ink-soft">
            New to networking? Get a few tips on getting started, plus email templates for reaching
            out.
          </p>
          <Link
            href="/contacts/guide"
            className="mt-4 inline-block rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper"
          >
            Open the networking guide
          </Link>
        </div>
      )}
    </div>
  );
}
