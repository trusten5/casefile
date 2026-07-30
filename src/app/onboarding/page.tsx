import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { completeOnboarding } from "@/app/(dashboard)/profile/actions";
import { StepIndicator } from "./StepIndicator";

export const dynamic = "force-dynamic";

// A user_preferences row only ever gets created by submitting this form (or
// the /profile one) — so its absence doubles as "hasn't seen onboarding yet"
// with no separate flag to track. Once it exists, skip straight to the
// dashboard so this screen only ever shows once.
export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const searchParams = await props.searchParams;
  const redirectTo = safeRedirectPath(searchParams.redirect_url, "/dashboard");
  const supabase = getSupabase();

  const { data } = await supabase
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) redirect(redirectTo);

  return (
    <div className="mx-auto max-w-md py-16">
      <StepIndicator step={1} />
      <h1 className="font-display text-2xl font-semibold text-ink">Welcome aboard</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Quick setup, then you&rsquo;re in — all of this is optional and editable later from your profile.
      </p>

      <form action={completeOnboarding} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Daily application goal
          <input
            type="number"
            name="dailyGoal"
            min={1}
            defaultValue={1}
            className="w-24 rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          School
          <input
            name="school"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Major
          <input
            name="major"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>

        <div className="mt-2 flex items-center gap-3">
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
            Get started
          </button>
          <button type="submit" className="text-sm text-ink-soft hover:text-ink">
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}
