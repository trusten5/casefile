import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { upsertFromSubscription } from "@/lib/stripeSubscriptionSync";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature ?? "",
      process.env.STRIPE_WEBHOOK_SIGNING_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      await upsertFromSubscription(subscription);
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await upsertFromSubscription(event.data.object as Stripe.Subscription);
  }

  return NextResponse.json({ received: true });
}
