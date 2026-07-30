import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { setPreferredRoleType } from "@/app/onboarding/actions";
import { StepIndicator } from "@/app/onboarding/StepIndicator";

const ROLE_TYPES = [
  { value: "internship", label: "Internships" },
  { value: "new_grad", label: "New grad roles" },
  { value: "full_time", label: "Full-time roles" },
];

export const dynamic = "force-dynamic";

// Picking one here sets it as the user's default /feed filter (same
// is_default row setDefaultFilter on /profile writes) — so this step
// actually shapes what they see next, not just a preference stored for
// later.
export default async function OnboardingInterestsPage(props: PageProps<"/onboarding/interests">) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const searchParams = await props.searchParams;
  const redirectTo = safeRedirectPath(searchParams.redirect_url, "/dashboard");

  return (
    <div className="animate-step-in mx-auto max-w-md py-16">
      <StepIndicator step={2} />
      <h1 className="font-display text-2xl font-semibold text-ink">What are you looking for?</h1>
      <p className="mt-2 text-sm text-ink-soft">
        This sets your default feed view — change it anytime from /feed or /profile.
      </p>

      <form action={setPreferredRoleType} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="flex flex-col gap-2">
          {ROLE_TYPES.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-2 rounded-lg border border-paper-line bg-paper px-3 py-2.5 text-sm text-ink transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-soft hover:shadow-sm has-[:checked]:border-ink has-[:checked]:bg-ink/5 has-[:checked]:shadow-sm"
            >
              <input type="radio" name="roleType" value={r.value} className="accent-ink" />
              {r.label}
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
