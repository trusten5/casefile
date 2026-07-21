import type Stripe from "stripe";
import { getSupabase } from "@/lib/supabase";

export const PRICE_TO_TIER: Record<string, "plus" | "pro"> = {
  [process.env.STRIPE_PRICE_PLUS_MONTHLY ?? ""]: "plus",
  [process.env.STRIPE_PRICE_PLUS_ANNUAL ?? ""]: "plus",
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""]: "pro",
  [process.env.STRIPE_PRICE_PRO_ANNUAL ?? ""]: "pro",
};

// Called for checkout.session.completed (after retrieving the full
// subscription), customer.subscription.updated, and
// customer.subscription.deleted — all three carry a full Stripe
// Subscription object with the same shape, so one function handles all
// three event types.
export async function upsertFromSubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata.user_id;
  if (!userId) return; // not one of ours — defensive, shouldn't happen

  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? PRICE_TO_TIER[priceId] : undefined;
  if (!tier) return;

  // ponytail: current_period_end moved from the Subscription object to
  // SubscriptionItem in a Stripe API breaking change (installed stripe@22
  // types no longer expose it top-level); this fallback covers both the
  // legacy shape (still used by our test fixture) and the current one.
  const currentPeriodEnd =
    (subscription as unknown as { current_period_end?: number }).current_period_end ??
    subscription.items.data[0]?.current_period_end;

  const supabase = getSupabase();
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      tier,
      status: subscription.status,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
