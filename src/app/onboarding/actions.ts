"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { safeRedirectPath, withFlash } from "@/lib/safeRedirect";

export async function setPreferredRoleType(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const redirectTo = safeRedirectPath(String(formData.get("redirectTo") ?? ""), "/dashboard");
  const roleType = String(formData.get("roleType") ?? "").trim();

  if (roleType) {
    const supabase = getSupabase();
    // Same "clear existing default, then insert" pattern as setDefaultFilter
    // on /profile — a brand-new user won't have one yet, but this stays
    // correct if onboarding is ever re-entered.
    const { error: clearError } = await supabase
      .from("saved_filters")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("scope", "feed");
    if (clearError) throw clearError;

    const { error } = await supabase
      .from("saved_filters")
      .insert({ user_id: userId, scope: "feed", name: "Default", role_type: roleType, is_default: true });
    if (error) throw error;
  }

  redirect(
    `/onboarding/companies?redirect_url=${encodeURIComponent(redirectTo)}${roleType ? `&roleType=${encodeURIComponent(roleType)}` : ""}`
  );
}

export async function followSuggestedCompanies(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const redirectTo = safeRedirectPath(String(formData.get("redirectTo") ?? ""), "/dashboard");
  const roleType = String(formData.get("roleType") ?? "").trim();
  const companyIds = formData.getAll("companyId").map(String).filter(Boolean);

  if (companyIds.length > 0) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("saved_companies")
      .upsert(
        companyIds.map((company_id) => ({ user_id: userId, company_id })),
        { onConflict: "user_id,company_id" }
      );
    if (error) throw error;
  }

  const params = new URLSearchParams({ redirect_url: redirectTo });
  if (roleType) params.set("roleType", roleType);
  if (companyIds.length > 0) params.set("companies", companyIds.join(","));
  redirect(`/onboarding/postings?${params.toString()}`);
}

export async function saveSuggestedPostings(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const redirectTo = safeRedirectPath(String(formData.get("redirectTo") ?? ""), "/dashboard");
  const postingIds = formData.getAll("postingId").map(String).filter(Boolean);

  if (postingIds.length > 0) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("saved_postings")
      .upsert(
        postingIds.map((posting_id) => ({ user_id: userId, posting_id })),
        { onConflict: "user_id,posting_id" }
      );
    if (error) throw error;
  }

  redirect(withFlash(redirectTo, "Welcome! Your picks are saved — everything else is editable from your profile."));
}
