import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { getUserTier, tierAtLeast } from "@/lib/subscriptions";
import { Flash } from "@/components/Flash";
import { createCheckoutSession } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing — Casefile" };

const PLANS = [
  {
    tier: "plus" as const,
    name: "Plus",
    price: "$1.99/mo",
    annualPrice: "$19/yr",
    monthlyPriceId: process.env.STRIPE_PRICE_PLUS_MONTHLY!,
    annualPriceId: process.env.STRIPE_PRICE_PLUS_ANNUAL!,
    blurb: "Get emailed when new postings match your saved feed filter.",
  },
  {
    tier: "pro" as const,
    name: "Pro",
    price: "$9.99/mo",
    annualPrice: "$99/yr",
    monthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    annualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL!,
    blurb: "Everything in Plus, plus AI-parsed application-status emails. Coming soon.",
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const { userId } = await auth();
  const currentTier = userId ? await getUserTier(getSupabase(), userId) : "free";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
        ← Back to Casefile
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">Pricing</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Casefile stays free forever. These are optional add-ons.
      </p>

      <Flash message={flash} />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div key={plan.tier} className="rounded-xl border border-paper-line p-6">
            <h2 className="font-display text-xl font-semibold text-ink">{plan.name}</h2>
            <p className="mt-2 text-sm text-ink-soft">{plan.blurb}</p>
            <p className="mt-4 font-display text-2xl font-semibold text-ink">{plan.price}</p>
            <p className="text-xs text-ink-soft">or {plan.annualPrice} billed annually</p>

            {currentTier === plan.tier ? (
              <p className="mt-6 text-sm font-medium text-status-offer">Current plan</p>
            ) : plan.tier === "pro" ? (
              <button
                type="button"
                disabled
                className="mt-6 w-full rounded-full border border-paper-line px-4 py-2 text-sm font-medium text-ink-soft"
              >
                Coming soon
              </button>
            ) : tierAtLeast(currentTier, plan.tier) ? (
              <button
                type="button"
                disabled
                className="mt-6 w-full rounded-full border border-paper-line px-4 py-2 text-sm font-medium text-ink-soft"
              >
                Included in your plan
              </button>
            ) : (
              <form action={createCheckoutSession.bind(null, plan.annualPriceId)}>
                <button
                  type="submit"
                  className="mt-6 w-full rounded-full border border-paper-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-soft"
                >
                  Subscribe annually
                </button>
              </form>
            )}
            {!tierAtLeast(currentTier, plan.tier) && plan.tier === "plus" && (
              <form action={createCheckoutSession.bind(null, plan.monthlyPriceId)}>
                <button
                  type="submit"
                  className="mt-2 w-full text-xs font-medium text-ink-soft hover:text-ink hover:underline"
                >
                  or pay monthly instead
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
