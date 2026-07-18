import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { Flash } from "@/components/Flash";
import { Avatar } from "@/components/Avatar";
import { companyDisplayName, companySlug } from "@/lib/companies";
import Link from "next/link";
import { logInteraction } from "../actions";

export const dynamic = "force-dynamic";

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  coffee_chat: "Coffee chat",
  email: "Email",
  event: "Event",
  referral: "Referral",
  other: "Other",
};

export default async function ContactDetailPage(props: PageProps<"/contacts/[id]">) {
  const { id } = await props.params;
  const { userId } = await auth();
  const searchParams = await props.searchParams;
  const flash = typeof searchParams.flash === "string" ? searchParams.flash : undefined;
  const supabase = getSupabase();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, name, role, how_met, linkedin_url, company:companies(name, slug)")
    .eq("id", id)
    .eq("user_id", userId ?? "")
    .single();
  if (contactError || !contact) notFound();

  const { data: interactions, error: interactionsError } = await supabase
    .from("interactions")
    .select("id, type, notes, follow_up_date, occurred_at")
    .eq("contact_id", id)
    .order("occurred_at", { ascending: false });

  const slug = companySlug(contact.company);
  const companyName = slug ? companyDisplayName(contact.company) : null;
  const logForContact = logInteraction.bind(null, contact.id, `/contacts/${contact.id}`);

  return (
    <div>
      <Flash message={flash} />
      <div className="flex items-center gap-4">
        <Avatar name={contact.name} />
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{contact.name}</h1>
          <p className="text-sm text-ink-soft">
            {contact.role}
            {contact.role && companyName ? " — " : ""}
            {slug ? (
              <Link href={`/companies/${slug}`} className="hover:underline">
                {companyName}
              </Link>
            ) : (
              companyName
            )}
          </p>
          {contact.how_met && <p className="mt-1 text-sm text-ink-soft">Met via {contact.how_met}</p>}
          {contact.linkedin_url && (
            <a
              href={contact.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-medium text-ink-soft hover:text-ink"
            >
              LinkedIn →
            </a>
          )}
        </div>
      </div>

      <h2 className="mt-10 font-display text-lg font-semibold text-ink">Log an interaction</h2>
      <form action={logForContact} className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Type
          <select
            name="type"
            defaultValue="coffee_chat"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          >
            {Object.entries(INTERACTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Date
          <input
            type="date"
            name="occurredAt"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Follow up on
          <input
            type="date"
            name="followUpDate"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-ink-soft">
          Notes
          <input
            name="notes"
            placeholder="Optional"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
          Log it
        </button>
      </form>

      {interactionsError && (
        <p className="mt-6 text-sm text-status-rejected">
          Couldn&apos;t load interaction history: {interactionsError.message}
        </p>
      )}

      <h2 className="mt-10 font-display text-lg font-semibold text-ink">History</h2>
      {interactions && interactions.length > 0 ? (
        <ul className="mt-4 divide-y divide-paper-line">
          {interactions.map((i) => (
            <li key={i.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-status-applied/15 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-status-applied">
                  {INTERACTION_TYPE_LABELS[i.type] ?? i.type}
                </span>
                <span className="font-mono text-xs text-ink-soft">
                  {new Date(i.occurred_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {i.follow_up_date && (
                  <span className="font-mono text-xs text-status-oa">
                    Follow up {i.follow_up_date}
                  </span>
                )}
              </div>
              {i.notes && <p className="mt-1 text-sm text-ink-soft">{i.notes}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">No interactions logged yet.</p>
      )}
    </div>
  );
}
