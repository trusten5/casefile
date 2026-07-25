import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendWelcomeEmail } from "@/lib/notify";

// Handles two Clerk lifecycle events: user.created sends the welcome email,
// user.deleted cleans up every row keyed by their Clerk user_id
// (applications, contacts, saved_postings, saved_companies, user_preferences,
// saved_filters) — without it those rows are orphaned forever, since there's
// no FK to a Clerk-synced users table to cascade on. status_history/
// interactions clean up on their own via "on delete cascade" against
// applications/contacts.
export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const email = event.data.email_addresses.find(
      (e) => e.id === event.data.primary_email_address_id
    )?.email_address;
    if (email) await sendWelcomeEmail(email);
  }

  if (event.type === "user.deleted" && event.data.id) {
    const userId = event.data.id;
    const supabase = getSupabase();
    const results = await Promise.all([
      supabase.from("applications").delete().eq("user_id", userId),
      supabase.from("contacts").delete().eq("user_id", userId),
      supabase.from("saved_postings").delete().eq("user_id", userId),
      supabase.from("saved_companies").delete().eq("user_id", userId),
      supabase.from("user_preferences").delete().eq("user_id", userId),
      supabase.from("saved_filters").delete().eq("user_id", userId),
    ]);

    // Deletes are idempotent (re-deleting an already-cleared table is a
    // no-op), so on partial failure it's safe to 500 and let Clerk's
    // built-in webhook retry finish the rest instead of leaving orphans.
    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      console.error("Clerk user.deleted cleanup failed:", failed.map((r) => r.error));
      return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
