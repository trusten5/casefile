"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { findOrCreateCompany } from "@/lib/companies";
import { inferRoleType, isPhdRole } from "@/lib/scrapers/types";
import { getStageRank } from "@/lib/applications";

export async function createManualApplication(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const companyName = String(formData.get("companyName") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim();
  const status = String(formData.get("status") ?? "applied");
  if (!companyName || !roleTitle) throw new Error("Company and role are required");

  const companyId = await findOrCreateCompany(supabase, { name: companyName });

  const { error } = await supabase.rpc("create_application_with_history", {
    p_user_id: userId,
    p_company_id: companyId,
    p_posting_id: null,
    p_role_title: roleTitle,
    p_role_type: inferRoleType(roleTitle),
    p_is_phd: isPhdRole(roleTitle),
    p_status: status,
    p_source: "manual",
  });
  if (error) throw error;

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  redirect(`/applications?flash=${encodeURIComponent("Application added")}`);
}

// Called directly from the status <select>'s onChange (no form, no submit
// button) — takes plain args instead of FormData since there's no form to
// read from, and skips the redirect+flash pattern other actions use since a
// full navigation on every dropdown change would be a jarring auto-save UX.
//
// `backfillStages` are stages the user confirmed they actually passed
// through but never logged (e.g. jumping Applied -> Interview really went
// through OA first) — see getSkippedStages. They're inserted as real
// status_history rows with timestamps just before "now", in order, so the
// flow chart reconstructs them as genuine intermediate transitions instead
// of the jump landing as one direct edge.
export async function updateApplicationStatus(
  applicationId: string,
  status: string,
  backfillStages: string[] = []
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const { data: current, error: currentError } = await supabase
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .single();
  if (currentError || !current) throw new Error("Application not found");
  if (current.status === status) return;

  const { error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .eq("user_id", userId);
  if (error) throw error;

  if (getStageRank(status) <= getStageRank(current.status)) {
    // Moving backward (or between the two terminal outcomes) is a
    // correction, not real progress — rewind history to the last time this
    // application was at `status` instead of recording a backward
    // transition, which would otherwise draw a nonsensical edge on the flow
    // chart. If `status` was never reached before, there's nothing to
    // rewind to — wipe the history and start fresh from here.
    const { data: history, error: historyFetchError } = await supabase
      .from("status_history")
      .select("status, changed_at")
      .eq("application_id", applicationId)
      .order("changed_at", { ascending: true });
    if (historyFetchError) throw historyFetchError;

    let lastOccurrence: string | null = null;
    for (const row of history ?? []) {
      if (row.status === status) lastOccurrence = row.changed_at;
    }

    if (lastOccurrence) {
      const { error: deleteError } = await supabase
        .from("status_history")
        .delete()
        .eq("application_id", applicationId)
        .gt("changed_at", lastOccurrence);
      if (deleteError) throw deleteError;
    } else {
      const { error: deleteError } = await supabase
        .from("status_history")
        .delete()
        .eq("application_id", applicationId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("status_history")
        .insert({ application_id: applicationId, status });
      if (insertError) throw insertError;
    }
  } else {
    // Forward progress — record it (plus any confirmed backfilled stages)
    // as real history so the flow chart's transition graph stays accurate.
    const now = Date.now();
    const rows = [
      ...backfillStages.map((s, i) => ({
        application_id: applicationId,
        status: s,
        changed_at: new Date(now - (backfillStages.length - i) * 1000).toISOString(),
      })),
      { application_id: applicationId, status, changed_at: new Date(now).toISOString() },
    ];

    const { error: historyError } = await supabase.from("status_history").insert(rows);
    if (historyError) throw historyError;
  }

  revalidatePath("/applications");
  revalidatePath("/dashboard");
}

// status_history rows cascade-delete via their FK, so removing the
// application is enough to clear its full history too.
export async function deleteApplication(applicationId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", applicationId)
    .eq("user_id", userId);
  if (error) throw error;

  revalidatePath("/applications");
  revalidatePath("/dashboard");
}
