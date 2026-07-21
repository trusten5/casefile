import { timingSafeEqual } from "crypto";

// Timing-safe compare so response latency can't leak how many leading
// characters of CRON_SECRET a guess got right. Any route gated by the same
// secret (sync-postings, this admin summary) should use this instead of a
// plain `!==` check.
export function isValidCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/, "");

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length === 0 || expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
