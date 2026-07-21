import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { isValidCronRequest } from "@/lib/cronAuth";
import { applyPostingFilters } from "@/lib/postingFilters";
import { isDigestDue } from "@/lib/digest";
import { sendDigestBatch, type DigestEmail } from "@/lib/postmarkBatch";
import { companyDisplayName } from "@/lib/companies";

export const maxDuration = 60;

async function runDigestSend(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const isMonday = new Date().getUTCDay() === 1;

  const { data: prefsRows, error: prefsError } = await supabase
    .from("user_preferences")
    .select("user_id, digest_cadence, digest_last_sent_at")
    .eq("digest_enabled", true);
  if (prefsError) throw prefsError;

  const dueUsers = (prefsRows ?? []).filter((row) => isDigestDue(row.digest_cadence, isMonday));
  if (dueUsers.length === 0) return NextResponse.json({ sent: 0 });

  // Re-check active subscription at send time, not just at toggle time —
  // a lapsed renewal shouldn't keep getting digests just because
  // digest_enabled was set while the subscription was still active.
  const { data: activeSubs } = await supabase
    .from("subscriptions")
    .select("user_id")
    .in(
      "user_id",
      dueUsers.map((u) => u.user_id)
    )
    .eq("status", "active");
  const activeUserIds = new Set((activeSubs ?? []).map((s) => s.user_id));
  const eligibleUsers = dueUsers.filter((u) => activeUserIds.has(u.user_id));
  if (eligibleUsers.length === 0) return NextResponse.json({ sent: 0 });

  const eligibleUserIds = eligibleUsers.map((u) => u.user_id);

  const { data: defaultFilters } = await supabase
    .from("saved_filters")
    .select("user_id, company, role_type, location, keyword, level")
    .in("user_id", eligibleUserIds)
    .eq("scope", "feed")
    .eq("is_default", true);
  const filterByUser = new Map((defaultFilters ?? []).map((f) => [f.user_id, f]));

  const clerk = await clerkClient();
  const emailByUser = new Map<string, string>();
  for (let i = 0; i < eligibleUserIds.length; i += 100) {
    const page = await clerk.users.getUserList({
      userId: eligibleUserIds.slice(i, i + 100),
      limit: 100,
    });
    for (const user of page.data) {
      const email = user.primaryEmailAddress?.emailAddress;
      if (email) emailByUser.set(user.id, email);
    }
  }

  const emails: DigestEmail[] = [];
  const userIdByEmail = new Map<DigestEmail, string>();

  for (const prefs of eligibleUsers) {
    const filter = filterByUser.get(prefs.user_id);
    const email = emailByUser.get(prefs.user_id);
    if (!filter || !email) continue;

    let query = supabase
      .from("postings")
      .select("title, location, url, posted_at, company:companies!inner(name)")
      .eq("is_active", true)
      .order("posted_at", { ascending: false })
      .limit(20);
    query = applyPostingFilters(query, {
      company: filter.company,
      roleType: filter.role_type,
      location: filter.location,
      keyword: filter.keyword,
      level: filter.level,
    });
    if (prefs.digest_last_sent_at) {
      query = query.gt("posted_at", prefs.digest_last_sent_at);
    }

    const { data: postings } = await query;
    if (!postings || postings.length === 0) continue;

    const lines = postings.map(
      (p) => `${companyDisplayName(p.company)} — ${p.title} (${p.location})\n${p.url}`
    );
    const digestEmail: DigestEmail = {
      to: email,
      subject: `${postings.length} new posting${postings.length === 1 ? "" : "s"} matching your filter`,
      textBody: lines.join("\n\n"),
    };
    emails.push(digestEmail);
    userIdByEmail.set(digestEmail, prefs.user_id);
  }

  const sentEmails = await sendDigestBatch(emails);
  const sentUserIds = sentEmails
    .map((email) => userIdByEmail.get(email))
    .filter((userId): userId is string => Boolean(userId));

  if (sentUserIds.length > 0) {
    await supabase
      .from("user_preferences")
      .update({ digest_last_sent_at: new Date().toISOString() })
      .in("user_id", sentUserIds);
  }

  return NextResponse.json({ sent: emails.length });
}

export const GET = runDigestSend;
export const POST = runDigestSend;
