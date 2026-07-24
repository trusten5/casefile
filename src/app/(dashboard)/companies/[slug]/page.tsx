import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Avatar } from "@/components/Avatar";
import { formatPostedDate } from "@/lib/dates";
import { PostingRow } from "../../feed/PostingRow";
import { SaveCompanyButton } from "../SaveCompanyButton";
import { saveCompany, unsaveCompany } from "../actions";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage(props: PageProps<"/companies/[slug]">) {
  const { slug } = await props.params;
  const { userId } = await auth();
  const supabase = getSupabase();

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url")
    .eq("slug", slug)
    .single();
  if (companyError || !company) notFound();

  // None of these four depend on each other — only on company.id/userId,
  // both already known — so they run as one batch instead of postings then
  // a separate batch afterward.
  const [{ data: postings, error: postingsError }, { data: savedCompany }, { data: contacts }, tier] =
    await Promise.all([
      supabase
        .from("postings")
        .select("id, title, location, role_type, url, posted_at")
        .eq("company_id", company.id)
        .eq("is_active", true)
        .order("posted_at", { ascending: false }),
      userId
        ? supabase
            .from("saved_companies")
            .select("company_id")
            .eq("user_id", userId)
            .eq("company_id", company.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      userId
        ? supabase
            .from("contacts")
            .select("id, name, role")
            .eq("company_id", company.id)
            .eq("user_id", userId)
            .order("name")
        : Promise.resolve({ data: [] as { id: string; name: string; role: string | null }[] }),
      userId ? getUserTier(supabase, userId) : Promise.resolve("free" as const),
    ]);

  const postingIds = (postings ?? []).map((p) => p.id);
  // Scoped to just this company's posting ids, not the user's whole
  // saved/applied history — this used to fetch every saved/applied
  // posting_id a user has ever had just to check membership here.
  const [{ data: saved }, { data: applied }] =
    userId && postingIds.length > 0
      ? await Promise.all([
          supabase
            .from("saved_postings")
            .select("posting_id")
            .eq("user_id", userId)
            .in("posting_id", postingIds),
          supabase
            .from("applications")
            .select("posting_id")
            .eq("user_id", userId)
            .not("posting_id", "is", null)
            .in("posting_id", postingIds),
        ])
      : [{ data: [] as { posting_id: string }[] }, { data: [] as { posting_id: string | null }[] }];

  const savedIds = new Set((saved ?? []).map((row) => row.posting_id));
  const appliedIds = new Set((applied ?? []).map((row) => row.posting_id));
  const isCompanySaved = Boolean(savedCompany);

  const rows = postings ?? [];
  const firstSeen = rows.reduce<string | null>(
    (min, p) => (!min || p.posted_at < min ? p.posted_at : min),
    null
  );

  const save = saveCompany.bind(null, company.id, `/companies/${company.slug}`);
  const unsave = unsaveCompany.bind(null, company.id, `/companies/${company.slug}`);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <CompanyLogo name={company.name} logoUrl={company.logo_url} />
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">{company.name}</h1>
            <p className="font-mono text-xs text-ink-soft">
              {rows.length} open posting{rows.length === 1 ? "" : "s"}
              {firstSeen ? ` · first seen ${formatPostedDate(firstSeen)}` : ""}
            </p>
          </div>
        </div>
        <SaveCompanyButton initialSaved={isCompanySaved} onSave={save} onUnsave={unsave} />
      </div>

      {userId && (
        <div className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            People you know here
          </h2>
          {contacts && contacts.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {contacts.map((c) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-2 rounded-full border border-paper-line bg-tab/20 py-1.5 pl-2 pr-4 hover:border-ink-soft"
                >
                  <Avatar name={c.name} />
                  <span className="text-sm font-medium text-ink">
                    {c.name}
                    {c.role ? ` — ${c.role}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">
              No contacts here yet —{" "}
              <Link href="/contacts" className="underline">
                add one
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {postingsError && (
        <p className="mt-6 text-sm text-status-rejected">
          Couldn&apos;t load postings: {postingsError.message}
        </p>
      )}

      {rows.length === 0 && !postingsError ? (
        <p className="mt-8 text-sm text-ink-soft">
          Nothing active from {company.name} right now — check back later.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-paper-line">
          {rows.map((posting) => (
            <PostingRow
              key={posting.id}
              posting={{
                ...posting,
                company: { name: company.name, logo_url: company.logo_url, slug: company.slug },
              }}
              isSaved={savedIds.has(posting.id)}
              isApplied={appliedIds.has(posting.id)}
              returnTo={`/companies/${company.slug}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
