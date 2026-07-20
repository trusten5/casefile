import type { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "plus" | "pro";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const TIER_ORDER: Tier[] = ["free", "plus", "pro"];

// One place every feature gate calls — "is this user Plus or Pro" is a
// single function call, not a scattered Stripe lookup. No row (or a row
// whose status has lapsed) means free tier.
export async function getUserTier(supabase: SupabaseClient, userId: string): Promise<Tier> {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !ACTIVE_STATUSES.has(data.status)) return "free";
  return data.tier as Tier;
}

export function tierAtLeast(tier: Tier, minimum: Tier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}
