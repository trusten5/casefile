"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorized");
}

export async function confirmBroken(postingId: string) {
  await requireAdmin();
  const supabase = getSupabase();
  const { error } = await supabase.from("postings").update({ is_active: false }).eq("id", postingId);
  if (error) throw error;

  revalidatePath("/admin/reports");
  revalidatePath("/feed");
  revalidatePath("/dashboard");
  // /companies caches its per-company posting counts under this tag (see
  // companies/page.tsx) — without this, a listing marked broken here stays
  // counted as active there until the 1hr fallback revalidate.
  revalidateTag("postings", "max");
  redirect(`/admin/reports?flash=${encodeURIComponent("Marked broken and hidden from the feed")}`);
}

export async function dismissReport(postingId: string) {
  await requireAdmin();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("postings")
    .update({ reported_broken_at: null })
    .eq("id", postingId);
  if (error) throw error;

  revalidatePath("/admin/reports");
  redirect(`/admin/reports?flash=${encodeURIComponent("Report dismissed")}`);
}

export async function markFeatureRequestRead(id: string) {
  await requireAdmin();
  const supabase = getSupabase();
  const { error } = await supabase.from("feature_requests").update({ is_read: true }).eq("id", id);
  if (error) throw error;

  revalidatePath("/admin/feature-requests");
  redirect(`/admin/feature-requests?flash=${encodeURIComponent("Marked read")}`);
}
