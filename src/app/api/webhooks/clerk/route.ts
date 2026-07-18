import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Clerk sends this when a user deletes their account. Without it, every row
// keyed by their Clerk user_id (applications, contacts, saved_postings,
// saved_companies, user_preferences, saved_filters) is orphaned forever —
// there's no FK to a Clerk-synced users table to cascade on.
// status_history/interactions clean up on their own via "on delete cascade"
// against applications/contacts.
export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "user.deleted" && event.data.id) {
    const userId = event.data.id;
    const supabase = getSupabase();
    await Promise.all([
      supabase.from("applications").delete().eq("user_id", userId),
      supabase.from("contacts").delete().eq("user_id", userId),
      supabase.from("saved_postings").delete().eq("user_id", userId),
      supabase.from("saved_companies").delete().eq("user_id", userId),
      supabase.from("user_preferences").delete().eq("user_id", userId),
      supabase.from("saved_filters").delete().eq("user_id", userId),
    ]);
  }

  return NextResponse.json({ received: true });
}
