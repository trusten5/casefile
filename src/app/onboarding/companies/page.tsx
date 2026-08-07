import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { CompanyLogo } from "@/components/CompanyLogo";
import { followSuggestedCompanies } from "@/app/onboarding/actions";
import { StepIndicator } from "@/app/onboarding/StepIndicator";

export const dynamic = "force-dynamic";

const RANDOM_COMPANY_COUNT = 30;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type CompanyOption = { id: string; name: string; logo_url: string | null };

function CompanyCheckbox({ company }: { company: CompanyOption }) {
  return (
    <label className="flex items-center gap-2 rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink transition-colors duration-150 hover:border-ink-soft has-[:checked]:border-ink has-[:checked]:bg-ink/5">
      <input type="checkbox" name="companyId" value={company.id} className="accent-ink" />
      <CompanyLogo name={company.name} logoUrl={company.logo_url} />
      <span className="truncate">{company.name}</span>
    </label>
  );
}

// is_notable is the same hand-curated flag the /companies "Popular
// companies" shelf uses (see 0006_saved_companies.sql) — reused here so
// this list and that shelf never drift out of sync with two separate
// curation lists. Everything else in the (much bigger) directory is shown
// below in a fresh random order each visit, so there's always something new
// to scroll through and pick from beyond the same fixed 20.
export default async function OnboardingCompaniesPage(props: PageProps<"/onboarding/companies">) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const searchParams = await props.searchParams;
  const redirectTo = safeRedirectPath(searchParams.redirect_url, "/dashboard");
  const roleType = typeof searchParams.roleType === "string" ? searchParams.roleType : "";

  const supabase = getSupabase();
  const [{ data: notable, error: notableError }, { data: rest, error: restError }] = await Promise.all([
    supabase.from("companies").select("id, name, logo_url").eq("is_notable", true).order("name"),
    supabase.from("companies").select("id, name, logo_url").eq("is_notable", false),
  ]);
  if (notableError) throw notableError;
  if (restError) throw restError;

  const moreCompanies = shuffle(rest ?? []).slice(0, RANDOM_COMPANY_COUNT);

  return (
    <div className="animate-step-in mx-auto max-w-2xl py-16">
      <StepIndicator step={3} />
      <h1 className="font-display text-2xl font-semibold text-ink">Follow a few companies</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Followed companies are easy to filter to on /feed and /companies — pick any that stand out.
      </p>

      <form action={followSuggestedCompanies} className="mt-8 flex flex-col gap-6">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="roleType" value={roleType} />

        <div>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wide text-ink-soft">Popular</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(notable ?? []).map((c) => (
              <CompanyCheckbox key={c.id} company={c} />
            ))}
          </div>
        </div>

        {moreCompanies.length > 0 && (
          <div>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wide text-ink-soft">More companies</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {moreCompanies.map((c) => (
                <CompanyCheckbox key={c.id} company={c} />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded bg-ink px-4 py-2 text-sm font-medium text-paper">
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
