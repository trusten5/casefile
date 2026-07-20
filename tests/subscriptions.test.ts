import { afterEach, describe, expect, it } from "vitest";
import { getSupabase } from "@/lib/supabase";
import { getUserTier, tierAtLeast } from "@/lib/subscriptions";

describe("tierAtLeast", () => {
  it("free does not meet plus", () => {
    expect(tierAtLeast("free", "plus")).toBe(false);
  });

  it("pro meets plus", () => {
    expect(tierAtLeast("pro", "plus")).toBe(true);
  });

  it("plus meets plus", () => {
    expect(tierAtLeast("plus", "plus")).toBe(true);
  });
});

describe("getUserTier", () => {
  const userId = "test-subscriptions-user";

  afterEach(async () => {
    await getSupabase().from("subscriptions").delete().eq("user_id", userId);
  });

  it("returns free when no subscription row exists", async () => {
    expect(await getUserTier(getSupabase(), "no-such-user")).toBe("free");
  });

  it("returns the tier when status is active", async () => {
    await getSupabase().from("subscriptions").insert({
      user_id: userId,
      stripe_customer_id: `cus_test_${Date.now()}`,
      tier: "plus",
      status: "active",
    });
    expect(await getUserTier(getSupabase(), userId)).toBe("plus");
  });

  it("returns free when status is canceled", async () => {
    await getSupabase().from("subscriptions").insert({
      user_id: userId,
      stripe_customer_id: `cus_test_${Date.now()}`,
      tier: "pro",
      status: "canceled",
    });
    expect(await getUserTier(getSupabase(), userId)).toBe("free");
  });
});
