import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { isValidCronRequest } from "@/lib/cronAuth";
import { sendDigestBatch, type DigestEmail } from "@/lib/postmarkBatch";

export const maxDuration = 60;

const STALL_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function runReengagementSend(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clerk = await clerkClient();
  const cutoff = Date.now() - STALL_THRESHOLD_MS;
  const stalledUserIds: string[] = [];
  const emailByUser = new Map<string, string>();

  // Page through every Clerk user rather than filtering server-side —
  // Clerk's list API has no "created before" query param.
  let offset = 0;
  for (;;) {
    const page = await clerk.users.getUserList({ limit: 100, offset, orderBy: "-created_at" });
    for (const user of page.data) {
      if (user.createdAt > cutoff) continue; // still within the grace window
      const email = user.primaryEmailAddress?.emailAddress;
      if (email) {
        stalledUserIds.push(user.id);
        emailByUser.set(user.id, email);
      }
    }
    if (page.data.length < 100) break;
    offset += 100;
  }
  if (stalledUserIds.length === 0) return NextResponse.json({ sent: 0 });

  const supabase = getSupabase();

  const [{ data: applied }, { data: saved }, { data: alreadySent }] = await Promise.all([
    supabase.from("applications").select("user_id").in("user_id", stalledUserIds),
    supabase.from("saved_postings").select("user_id").in("user_id", stalledUserIds),
    supabase
      .from("user_preferences")
      .select("user_id")
      .in("user_id", stalledUserIds)
      .not("reengagement_sent_at", "is", null),
  ]);

  const excluded = new Set([
    ...(applied ?? []).map((r) => r.user_id),
    ...(saved ?? []).map((r) => r.user_id),
    ...(alreadySent ?? []).map((r) => r.user_id),
  ]);
  const candidateIds = stalledUserIds.filter((id) => !excluded.has(id));
  if (candidateIds.length === 0) return NextResponse.json({ sent: 0 });

  const emails: DigestEmail[] = [];
  const userIdByEmail = new Map<DigestEmail, string>();
  for (const userId of candidateIds) {
    const email = emailByUser.get(userId);
    if (!email) continue;
    const digestEmail: DigestEmail = {
      to: email,
      subject: "Still there? Here's the fastest way in",
      textBody: `You signed up but haven't added anything yet — takes about 30 seconds: save one posting from today's feed.\n\n${SITE_URL}/feed`,
    };
    emails.push(digestEmail);
    userIdByEmail.set(digestEmail, userId);
  }

  const sentEmails = await sendDigestBatch(emails);
  const sentUserIds = sentEmails
    .map((email) => userIdByEmail.get(email))
    .filter((userId): userId is string => Boolean(userId));

  if (sentUserIds.length > 0) {
    await supabase.from("user_preferences").upsert(
      sentUserIds.map((userId) => ({
        user_id: userId,
        reengagement_sent_at: new Date().toISOString(),
      })),
      { onConflict: "user_id" }
    );
  }

  return NextResponse.json({ sent: sentUserIds.length });
}

export const GET = runReengagementSend;
export const POST = runReengagementSend;
