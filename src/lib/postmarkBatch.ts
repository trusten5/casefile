import { pool } from "@/lib/pool";

export type DigestEmail = { to: string; subject: string; textBody: string };

// Postmark's batch endpoint accepts up to 500 messages per call — chunk
// through the existing worker-pool pattern instead of looping one fetch
// per subscriber, which is what times out as subscriber count grows.
const POSTMARK_BATCH_LIMIT = 500;
const CHUNK_CONCURRENCY = 4;

// Returns the subset of `emails` whose chunk actually sent — a failed chunk
// (rejected fetch) is swallowed, matching notify.ts's best-effort convention,
// so one bad chunk doesn't sink the chunks that already went out over the
// network. Callers must only treat the returned emails as sent.
export async function sendDigestBatch(emails: DigestEmail[]): Promise<DigestEmail[]> {
  const { POSTMARK_SERVER_TOKEN, POSTMARK_FROM_EMAIL } = process.env;
  if (!POSTMARK_SERVER_TOKEN || !POSTMARK_FROM_EMAIL || emails.length === 0) return [];

  const chunks: DigestEmail[][] = [];
  for (let i = 0; i < emails.length; i += POSTMARK_BATCH_LIMIT) {
    chunks.push(emails.slice(i, i + POSTMARK_BATCH_LIMIT));
  }

  const results = await pool(chunks, CHUNK_CONCURRENCY, async (chunk) => {
    try {
      await fetch("https://api.postmarkapp.com/email/batch", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": POSTMARK_SERVER_TOKEN,
        },
        body: JSON.stringify(
          chunk.map((email) => ({
            From: POSTMARK_FROM_EMAIL,
            To: email.to,
            Subject: email.subject,
            TextBody: email.textBody,
          }))
        ),
      });
      return chunk;
    } catch {
      // Best-effort per chunk — other chunks may have already sent.
      return [];
    }
  });

  return results.flat();
}
