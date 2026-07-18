"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export async function saveCompany(companyId: string, returnTo: string) {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`);
  const supabase = getSupabase();

  const { error } = await supabase
    .from("saved_companies")
    .upsert({ user_id: userId, company_id: companyId }, { onConflict: "user_id,company_id" });
  if (error) throw error;

  revalidatePath(returnTo);
  revalidatePath("/companies");
}

export async function unsaveCompany(companyId: string, returnTo: string) {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`);
  const supabase = getSupabase();

  const { error } = await supabase
    .from("saved_companies")
    .delete()
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;

  revalidatePath(returnTo);
  revalidatePath("/companies");
}
