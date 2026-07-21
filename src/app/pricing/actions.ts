"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";
import { PRICE_TO_TIER } from "@/lib/stripeSubscriptionSync";

export async function createCheckoutSession(priceId: string) {
  if (!(priceId in PRICE_TO_TIER)) throw new Error("Invalid price");

  const { userId } = await auth();
  if (!userId) redirect(`/sign-up?redirect_url=${encodeURIComponent("/profile")}`);

  const stripe = getStripe();
  const supabase = getSupabase();

  // Reuse an existing Stripe customer if this user already has one (e.g.
  // switching plans), so Stripe doesn't fragment one person across
  // multiple customer records.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existing?.stripe_customer_id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/profile?flash=${encodeURIComponent("Subscription active — welcome!")}`,
    cancel_url: `${siteUrl}/profile?flash=${encodeURIComponent("Checkout canceled")}`,
    // Carried onto the Subscription object itself (not just this session),
    // so every later webhook event — not only checkout.session.completed —
    // can resolve which Casefile user this Stripe subscription belongs to.
    subscription_data: { metadata: { user_id: userId } },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  redirect(session.url);
}

export async function createPortalSession() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = getSupabase();
  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) redirect("/profile");

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${siteUrl}/profile`,
  });
  redirect(session.url);
}
