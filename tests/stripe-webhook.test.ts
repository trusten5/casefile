import { afterEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { getSupabase } from "@/lib/supabase";
import { upsertFromSubscription } from "@/lib/stripeSubscriptionSync";

function fakeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: "sub_test_123",
    customer: "cus_test_123",
    status: "active",
    current_period_end: Math.floor(Date.now() / 1000) + 86400,
    metadata: { user_id: "test-webhook-user" },
    items: { data: [{ price: { id: process.env.STRIPE_PRICE_PLUS_MONTHLY } }] },
    ...overrides,
  } as Stripe.Subscription;
}

describe("upsertFromSubscription", () => {
  afterEach(async () => {
    await getSupabase().from("subscriptions").delete().eq("user_id", "test-webhook-user");
  });

  it("creates a subscriptions row from an active subscription", async () => {
    await upsertFromSubscription(fakeSubscription());
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("tier, status")
      .eq("user_id", "test-webhook-user")
      .single();
    expect(data!.tier).toBe("plus");
    expect(data!.status).toBe("active");
  });

  it("marks status canceled on a deleted subscription event", async () => {
    await upsertFromSubscription(fakeSubscription());
    await upsertFromSubscription(fakeSubscription({ status: "canceled" }));
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("status")
      .eq("user_id", "test-webhook-user")
      .single();
    expect(data!.status).toBe("canceled");
  });

  it("ignores a subscription with no user_id metadata", async () => {
    await upsertFromSubscription(fakeSubscription({ metadata: {}, customer: "cus_test_orphan" }));
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("id")
      .eq("stripe_customer_id", "cus_test_orphan");
    expect(data).toHaveLength(0);
  });
});
