// Fire-and-forget email via Postmark's HTTP API directly — no SDK needed for
// a single transactional send. No-ops silently if the env isn't configured,
// since a missing notification shouldn't break the user-facing action that
// triggered it.
export async function notifyAdminOfReport(posting: { title: string; url: string }) {
  const { POSTMARK_SERVER_TOKEN, POSTMARK_FROM_EMAIL, ADMIN_EMAIL } = process.env;
  if (!POSTMARK_SERVER_TOKEN || !POSTMARK_FROM_EMAIL || !ADMIN_EMAIL) return;

  try {
    await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_SERVER_TOKEN,
      },
      body: JSON.stringify({
        From: POSTMARK_FROM_EMAIL,
        To: ADMIN_EMAIL,
        Subject: `Broken link reported: ${posting.title}`,
        TextBody: `"${posting.title}" was reported broken.\n\nPosting: ${posting.url}\n\nReview: ${
          process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
        }/admin/reports`,
      }),
    });
  } catch (err) {
    // Best-effort — the report itself already succeeded in the DB.
    console.error("notifyAdminOfReport failed:", err);
  }
}
