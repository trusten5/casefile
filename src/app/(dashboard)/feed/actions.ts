"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { notifyAdminOfReport } from "@/lib/notify";

// Plain async return (no redirect/flash) rather than the older
// form-submit-and-reload pattern — called directly from a client toggle
// (SavePostingToggle) the same way saveCompany/unsaveCompany already are,
// so save/unsave can flip in place without a full page navigation.
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

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      company_id: posting.company_id,
      posting_id: postingId,
      role_title: posting.title,
      status: "applied",
      source: "feed",
      role_type: posting.role_type,
      is_phd: posting.is_phd,
    })
    .select("id")
    .single();
  if (applicationError) throw applicationError;

  const { error: historyError } = await supabase
    .from("status_history")
    .insert({ application_id: application.id, status: "applied" });
  if (historyError) throw historyError;

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

  // The reporting user doesn't need to wait on an admin email — schedule it
  // for after the response instead of blocking this action on Postmark.
  after(() => notifyAdminOfReport(posting));

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  revalidatePath("/admin/reports");
}
