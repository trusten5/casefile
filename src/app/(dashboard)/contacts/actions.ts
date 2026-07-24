"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { findCompanyId } from "@/lib/companies";

export async function createContact(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const name = String(formData.get("name") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const howMet = String(formData.get("howMet") ?? "").trim();
  const howMetCategory = String(formData.get("howMetCategory") ?? "other");
  const referredByContactId = String(formData.get("referredByContactId") ?? "").trim();
  const linkedinUrl = String(formData.get("linkedinUrl") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const companyId = companyName ? await findCompanyId(supabase, companyName) : undefined;

  // Verify the referrer is actually one of this user's own contacts before
  // linking to it — the id comes from a <select>, but never trust a client
  // value for something that grants a cross-row reference.
  let referredBy: string | null = null;
  if (referredByContactId) {
    const { data: referrer } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", referredByContactId)
      .eq("user_id", userId)
      .maybeSingle();
    referredBy = referrer?.id ?? null;
  }

  const { error } = await supabase.from("contacts").insert({
    user_id: userId,
    name,
    company_id: companyId ?? null,
    // Only kept when the typed name didn't match a tracked company — once
    // company_id resolves, companies.name is the source of truth.
    company_name_input: companyId ? null : companyName || null,
    role: role || null,
    how_met: howMet || null,
    how_met_category: howMetCategory,
    referred_by_contact_id: referredBy,
    linkedin_url: linkedinUrl || null,
  });
  if (error) throw error;

  revalidatePath("/contacts");
  revalidatePath("/companies");
  redirect(`/contacts?flash=${encodeURIComponent("Contact added")}`);
}

export async function logInteraction(contactId: string, returnTo: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  // interactions has no user_id of its own — ownership is verified via the contact.
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("user_id", userId)
    .single();
  if (contactError || !contact) throw new Error("Contact not found");

  const type = String(formData.get("type") ?? "other");
  const notes = String(formData.get("notes") ?? "").trim();
  const occurredAt = String(formData.get("occurredAt") ?? "").trim();
  const followUpDate = String(formData.get("followUpDate") ?? "").trim();

  const { error } = await supabase.from("interactions").insert({
    contact_id: contactId,
    type,
    notes: notes || null,
    occurred_at: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
    follow_up_date: followUpDate || null,
  });
  if (error) throw error;

  revalidatePath(returnTo);
  revalidatePath("/dashboard");
  redirect(`${returnTo}?flash=${encodeURIComponent("Interaction logged")}`);
}
