import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ROLE_TYPE_LABELS } from "@/lib/roleType";
import { saveSuggestedPostings } from "@/app/onboarding/actions";
import { StepIndicator } from "@/app/onboarding/StepIndicator";

export const dynamic = "force-dynamic";

// Prefers postings from the companies just followed in the previous step
// (a genuinely relevant suggestion) and only falls back to the general
// notable-companies pool when nothing was followed there.
export default async function OnboardingPostingsPage(props: PageProps<"/onboarding/postings">) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const searchParams = await props.searchParams;
  const redirectTo = safeRedirectPath(searchParams.redirect_url, "/dashboard");
  const roleType = typeof searchParams.roleType === "string" ? searchParams.roleType : "";
  const followedCompanyIds =
    typeof searchParams.companies === "string" ? searchParams.companies.split(",").filter(Boolean) : [];

  const supabase = getSupabase();

  let companyIds = followedCompanyIds;
  if (companyIds.length === 0) {
    const { data: notable, error } = await supabase.from("companies").select("id").eq("is_notable", true);
    if (error) throw error;
    companyIds = (notable ?? []).map((c) => c.id);
  }

  let postingsQuery = supabase
    .from("postings")
    .select("id, title, location, role_type, company:companies!inner(name, logo_url)")
    .eq("is_active", true)
    .in("company_id", companyIds)
    .order("posted_at", { ascending: false })
    .limit(6);
  if (roleType) postingsQuery = postingsQuery.eq("role_type", roleType);
  const { data: postings, error: postingsError } = await postingsQuery;
  if (postingsError) throw postingsError;

  return (
    <div className="mx-auto max-w-md py-16">
      <StepIndicator step={4} />
      <h1 className="font-display text-2xl font-semibold text-ink">Save a few to start</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Saved postings show up on /dashboard and /applications — a running list, not a commitment to apply.
      </p>

      <form action={saveSuggestedPostings} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="flex flex-col gap-2">
          {postings?.map((p) => {
            const company = Array.isArray(p.company) ? p.company[0] : p.company;
            return (
              <label
                key={p.id}
                className="flex items-center gap-3 rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink hover:border-ink-soft"
              >
                <input type="checkbox" name="postingId" value={p.id} className="accent-ink" />
                <CompanyLogo name={company?.name ?? "?"} logoUrl={company?.logo_url ?? null} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {company?.name}
                    {p.location ? ` · ${p.location}` : ""}
                    {p.role_type && ROLE_TYPE_LABELS[p.role_type] ? ` · ${ROLE_TYPE_LABELS[p.role_type]}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
          {postings?.length === 0 && (
            <p className="text-sm text-ink-soft">Nothing matching right now — head to /feed to browse everything.</p>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3">
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
            Finish
          </button>
          <button type="submit" className="text-sm text-ink-soft hover:text-ink">
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}
