"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { notifyAdminOfReport } from "@/lib/notify";

// Plain async return (no redirect/flash) rather than the older
// form-submit-and-reload pattern — called directly from a client toggle
// (SavePostingToggle) the same way saveCompany/unsaveCompany already are,
// so save/unsave can flip in place without a full page navigation. The
// free-tier upsell banner is decided client-side by the toggle itself
// (matching SaveCompanyButton), not here.
export async function savePosting(postingId: string, returnTo: string) {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`);
  const supabase = getSupabase();

  const { error } = await supabase
    .from("saved_postings")
    .upsert({ user_id: userId, posting_id: postingId }, { onConflict: "user_id,posting_id" });
  if (error) throw error;

  revalidatePath(returnTo);
}

export async function unsavePosting(postingId: string, returnTo: string) {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`);
  const supabase = getSupabase();

  const { error } = await supabase
    .from("saved_postings")
    .delete()
    .eq("user_id", userId)
    .eq("posting_id", postingId);
  if (error) throw error;

  revalidatePath(returnTo);
}

export async function applyFromPosting(postingId: string, returnTo: string) {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`);
  const supabase = getSupabase();

  const { data: posting, error: postingError } = await supabase
    .from("postings")
    .select("company_id, title, role_type, is_phd")
    .eq("id", postingId)
    .single();
  if (postingError) throw postingError;

  const { error: rpcError } = await supabase.rpc("create_application_with_history", {
    p_user_id: userId,
    p_company_id: posting.company_id,
    p_posting_id: postingId,
    p_role_title: posting.title,
    p_role_type: posting.role_type,
    p_is_phd: posting.is_phd,
  });
  if (rpcError) throw rpcError;

  revalidatePath(returnTo);
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  redirect(`${returnTo}?flash=${encodeURIComponent("Application added")}`);
}

// Called directly from the client (not a form action) — no redirect on
// success, since the UI just swaps to a "reported" state in place rather
// than navigating. Anonymous visitors still get redirected to sign-up,
// same as the other actions here, since reporting requires a returnTo
// destination anyway.
// A report only flags the posting for admin review (/admin/reports) — it
// stays visible (is_active unchanged) until confirmed there, so one bad
// report can't take a live posting down for everyone. reported_broken_at
// is separate from is_active so the next sync's upsert can't clobber it.
export async function reportBrokenLink(postingId: string, returnTo: string) {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`);
  const supabase = getSupabase();

  const { data: posting, error } = await supabase
    .from("postings")
    .update({ reported_broken_at: new Date().toISOString() })
    .eq("id", postingId)
    .select("title, url")
    .single();
  if (error) throw error;

  await notifyAdminOfReport(posting);

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  revalidatePath("/admin/reports");
}
