import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ponytail: createRouteMatcher is deprecated in this Clerk version in favor of
// per-route auth.protect() calls, but path-based matching is one file instead
// of one check per page — fine at 3 routes, migrate if that list grows a lot.

// Routes under the (dashboard) route group render at these paths (route groups
// don't add a URL segment), so match them directly rather than "/dashboard(.*)".
// /feed and /companies are deliberately NOT gated — public job-posting data,
// browsable without an account. The pages themselves already degrade
// gracefully with no signed-in user; the mutation actions they call
// (save/apply/report) redirect to sign-up instead of throwing when anonymous.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/applications(.*)",
  "/contacts(.*)",
  "/profile(.*)",
  "/admin(.*)",
  "/onboarding(.*)",
]);

// /feed and /companies are public and unauthenticated, so they're the only
// routes real abuse/scraping traffic could hit at volume.
const isRateLimitedRoute = createRouteMatcher(["/feed(.*)", "/companies(.*)"]);

const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;
// ponytail: per-instance in-memory counter, not a shared store — resets on
// cold start, doesn't coordinate across regions/instances, and never evicts
// stale IPs (acceptable since Edge instances recycle periodically). A soft
// brake on a single hot path, not real DDoS protection. Swap for Upstash
// Ratelimit (or similar shared store) if public traffic actually spikes.
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
    return;
  }

  if (isRateLimitedRoute(req)) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return new NextResponse("Too many requests", { status: 429 });
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
