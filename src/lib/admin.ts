import { auth, clerkClient } from "@clerk/nextjs/server";

// isAdmin() used to call currentUser() — a real Clerk API network round
// trip — on every single page load for every signed-in user, just to
// compare an email. Can't fix this with unstable_cache: clerkClient() reads
// headers() internally (to pick up middleware-injected options), and Next's
// cache explicitly forbids that inside a cache scope (confirmed by testing —
// it throws ClerkUseCacheError, not a theoretical restriction). So this is a
// plain module-level cache instead, same lazy-singleton shape as
// getSupabase() — the admin's Clerk userId barely ever changes, so a lookup
// once per warm instance (bounded by TTL) is enough to turn "a Clerk API
// call on every request" into "one call every 10 minutes, total."
const ADMIN_ID_TTL_MS = 10 * 60 * 1000;
let cachedAdminUserId: string | null | undefined;
let cachedAt = 0;

async function getAdminUserId(): Promise<string | null> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return null;

  if (cachedAdminUserId === undefined || Date.now() - cachedAt > ADMIN_ID_TTL_MS) {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ emailAddress: [adminEmail] });
    cachedAdminUserId = data[0]?.id ?? null;
    cachedAt = Date.now();
  }
  return cachedAdminUserId;
}

// Single-owner project — no roles table, just a signed-in check against one
// known email. Swap for a real roles system if this ever needs more than
// one admin.
export async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;

  const adminUserId = await getAdminUserId();
  return userId === adminUserId;
}
