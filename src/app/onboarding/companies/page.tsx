import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { CompanyLogo } from "@/components/CompanyLogo";
import { followSuggestedCompanies } from "@/app/onboarding/actions";
import { StepIndicator } from "@/app/onboarding/StepIndicator";

export const dynamic = "force-dynamic";

// is_notable is the same hand-curated flag the /companies "Popular
// companies" shelf uses (see 0006_saved_companies.sql) — reused here so
// this list and that shelf never drift out of sync with two separate
// curation lists.
export default async function OnboardingCompaniesPage(props: PageProps<"/onboarding/companies">) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const searchParams = await props.searchParams;
  const redirectTo = safeRedirectPath(searchParams.redirect_url, "/dashboard");
  const roleType = typeof searchParams.roleType === "string" ? searchParams.roleType : "";

  const supabase = getSupabase();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, logo_url")
    .eq("is_notable", true)
    .order("name")
    .limit(12);
  if (error) throw error;

  return (
    <div className="mx-auto max-w-md py-16">
      <StepIndicator step={3} />
      <h1 className="font-display text-2xl font-semibold text-ink">Follow a few companies</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Followed companies are easy to filter to on /feed and /companies — pick any that stand out.
      </p>

      <form action={followSuggestedCompanies} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="roleType" value={roleType} />
        <div className="grid grid-cols-2 gap-2">
          {companies?.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink hover:border-ink-soft"
            >
              <input type="checkbox" name="companyId" value={c.id} className="accent-ink" />
              <CompanyLogo name={c.name} logoUrl={c.logo_url} />
              <span className="truncate">{c.name}</span>
            </label>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3">
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
            Continue
          </button>
          <button type="submit" className="text-sm text-ink-soft hover:text-ink">
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}
