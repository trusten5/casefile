"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { FilterScope } from "@/lib/preferences";
import { getUserTier, tierAtLeast } from "@/lib/subscriptions";
import { safeRedirectPath } from "@/lib/safeRedirect";

export async function updatePreferences(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const dailyGoal = Math.max(1, parseInt(String(formData.get("dailyGoal") ?? "1"), 10) || 1);
  const school = String(formData.get("school") ?? "").trim();
  const major = String(formData.get("major") ?? "").trim();
  const experience = String(formData.get("experience") ?? "").trim();
  const resumeUrl = String(formData.get("resumeUrl") ?? "").trim();
  const coverLetterUrl = String(formData.get("coverLetterUrl") ?? "").trim();

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      daily_goal: dailyGoal,
      school: school || null,
      major: major || null,
      experience: experience || null,
      resume_url: resumeUrl || null,
      cover_letter_url: coverLetterUrl || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect(`/profile?flash=${encodeURIComponent("Preferences saved")}`);
}

export async function completeOnboarding(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const dailyGoal = Math.max(1, parseInt(String(formData.get("dailyGoal") ?? "1"), 10) || 1);
  const school = String(formData.get("school") ?? "").trim();
  const major = String(formData.get("major") ?? "").trim();

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      daily_goal: dailyGoal,
      school: school || null,
      major: major || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;

  const redirectTo = safeRedirectPath(String(formData.get("redirectTo") ?? ""), "/dashboard");
  redirect(`/onboarding/interests?redirect_url=${encodeURIComponent(redirectTo)}`);
}

export async function createSavedFilter(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const scope = String(formData.get("scope") ?? "");
  if (scope !== "feed" && scope !== "applications") throw new Error("Invalid scope");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const { error } = await supabase.from("saved_filters").insert({
    user_id: userId,
    scope,
    name,
    company: String(formData.get("company") ?? "").trim(),
    role_type: String(formData.get("roleType") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    keyword: String(formData.get("keyword") ?? "").trim(),
    level: String(formData.get("level") ?? "").trim(),
  });
  if (error) throw error;

  revalidatePath("/profile");
  revalidatePath(`/${scope}`);
  redirect(`/profile?flash=${encodeURIComponent("Filter saved")}`);
}

export async function deleteSavedFilter(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const { error } = await supabase.from("saved_filters").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;

  revalidatePath("/profile");
}

export async function setDefaultFilter(id: string, scope: FilterScope, makeDefault: boolean) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  if (makeDefault) {
    // Only one default per scope — clear any existing one first.
    const { error: clearError } = await supabase
      .from("saved_filters")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("scope", scope);
    if (clearError) throw clearError;
  }

  const { error } = await supabase
    .from("saved_filters")
    .update({ is_default: makeDefault })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;

  revalidatePath("/profile");
  revalidatePath(`/${scope}`);
}

export async function updateDigestPreferences(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  // Re-check tier server-side — the UI only shows this form to Plus/Pro
  // users, but a direct POST shouldn't be able to bypass that.
  const tier = await getUserTier(supabase, userId);
  if (!tierAtLeast(tier, "plus")) throw new Error("Requires a Plus subscription");

  const digestEnabled = formData.get("digestEnabled") === "on";
  const digestCadence = String(formData.get("digestCadence") ?? "daily");
  if (digestCadence !== "daily" && digestCadence !== "weekly") throw new Error("Invalid cadence");

  if (digestEnabled) {
    const { data: defaultFilter } = await supabase
      .from("saved_filters")
      .select("id")
      .eq("user_id", userId)
      .eq("scope", "feed")
      .eq("is_default", true)
      .maybeSingle();
    if (!defaultFilter) {
      throw new Error("Set a default feed filter below before enabling the digest");
    }
  }

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      digest_enabled: digestEnabled,
      digest_cadence: digestCadence,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;

  revalidatePath("/profile");
  redirect(`/profile?flash=${encodeURIComponent(digestEnabled ? "Digest enabled" : "Digest updated")}`);
}

export async function createFeatureRequest(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Feature request can't be empty");

  const { error } = await supabase.from("feature_requests").insert({ user_id: userId, body });
  if (error) throw error;

  redirect(`/profile?flash=${encodeURIComponent("Thanks — we'll take a look")}`);
}
