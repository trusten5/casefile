# Monetization: Pre-Launch Fixes + Plus Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three pre-launch risks the audit surfaced, then ship the
$1.99/mo Plus tier (Stripe billing + a saved-filter email digest). The Pro
tier (AI inbound-email tracking) is a separate plan, written later per
`docs/superpowers/specs/2026-07-20-monetization-design.md`.

**Architecture:** Stripe Checkout (hosted) + a `subscriptions` table as the
entitlement source of truth, synced via a Stripe webhook mirroring the
existing Clerk webhook's shape. The digest reuses the existing saved-filters
feature and sends via Postmark's batch endpoint through the existing
worker-pool pattern — no queue system.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase
(`@supabase/supabase-js`, no ORM), Clerk (`@clerk/nextjs`), Stripe
(`stripe` Node SDK), Postmark (raw HTTP API, no SDK), Vitest (new — no test
runner exists yet).

## Global Constraints

- Every DB-touching function in this codebase takes an explicit
  `SupabaseClient` or calls `getSupabase()` directly — never a client-side
  Supabase import. Follow this in every new file.
- Server actions follow the existing pattern: `"use server"` at the top,
  `auth()` from `@clerk/nextjs/server` for the caller's identity, `throw`
  raw Supabase errors (no custom error wrapping — this codebase doesn't do
  that today), `revalidatePath(...)` the affected routes, `redirect` with a
  `?flash=` query param for user-visible confirmation.
- Money-touching code (Stripe checkout/webhook, digest send) gets tests;
  everything else in this plan follows the existing codebase's convention
  of no tests, since retrofitting tests onto unrelated pre-existing code is
  out of scope here.
- New migrations go in `supabase/migrations/`, numbered sequentially
  continuing from `0013_source_stats_view.sql` (next is `0014`).
- No new npm dependencies beyond `stripe`, `vitest`, and `dotenv` (test-only).

---

## File Structure

New files this plan creates:
- `vitest.config.ts`, `vitest.setup.ts` — test runner config
- `tests/cronAuth.test.ts`, `tests/cross-user-access.test.ts`,
  `tests/atomic-application.test.ts`, `tests/subscriptions.test.ts`,
  `tests/stripe-webhook.test.ts`, `tests/digest.test.ts`
- `src/lib/cronAuth.ts` — shared timing-safe cron auth check
- `src/lib/subscriptions.ts` — `getUserTier` / `tierAtLeast`
- `src/lib/stripe.ts` — lazy Stripe client (mirrors `src/lib/supabase.ts`)
- `src/lib/stripeSubscriptionSync.ts` — `upsertFromSubscription`
- `src/lib/digest.ts` — `isDigestDue` cadence rule
- `src/lib/postmarkBatch.ts` — batch email sender
- `src/app/pricing/page.tsx`, `src/app/pricing/actions.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/send-digests/route.ts`
- `supabase/migrations/0014_atomic_application_insert.sql`
- `supabase/migrations/0015_subscriptions_and_digest.sql`

Existing files this plan modifies:
- `src/app/(dashboard)/feed/actions.ts` — `applyFromPosting` calls the new RPC
- `src/app/(dashboard)/applications/actions.ts` — `createManualApplication` calls the same RPC
- `src/app/api/sync-postings/route.ts` — timing-safe auth + visible failures
- `src/lib/preferences.ts` — digest fields on `UserPreferences`
- `src/app/(dashboard)/profile/actions.ts` — `updateDigestPreferences`
- `src/app/(dashboard)/profile/page.tsx` — subscription status + digest UI
- `src/app/(dashboard)/layout.tsx` — "Pricing" nav link
- `vercel.json` — new `send-digests` cron entry
- `package.json`, `.env.example` — new deps/env vars

---

### Task 1: Test runner setup

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `tests/smoke.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` running Vitest against `tests/**/*.test.ts`, with
  `.env.local` loaded and the `@/*` path alias resolved, so every later
  task's tests can just `import { getSupabase } from "@/lib/supabase"`.

- [ ] **Step 1: Install dependencies**

```bash
npm install -D vitest dotenv
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```typescript
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Add the `test` script to `package.json`**

Add to the `"scripts"` block:

```json
"test": "vitest run"
```

- [ ] **Step 5: Write a smoke test**

```typescript
// tests/smoke.test.ts
import { describe, expect, it } from "vitest";

describe("test runner", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: `1 passed`, confirming Vitest, the path alias, and `.env.local`
loading all work before any real test depends on them.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts vitest.setup.ts tests/smoke.test.ts package.json package-lock.json
git commit -m "Add Vitest test runner"
```

---

### Task 2: Cross-user data-access test

Regression coverage for the audit's top finding: every table's
authorization is a hand-written `.eq("user_id", ...)` filter with no RLS
backstop. This test calls the real server actions (with `auth()` mocked to
a second user) against the actual dev Supabase project in `.env.local`, and
asserts the current code already isolates users correctly — it should pass
immediately, since the behavior under test already exists and is already
correct. Its job is to fail the moment a *future* change breaks that
isolation.

**Files:**
- Create: `tests/cross-user-access.test.ts`

**Interfaces:**
- Consumes: `updateApplicationStatus`, `deleteApplication` (from
  `src/app/(dashboard)/applications/actions.ts`); `deleteSavedFilter`,
  `setDefaultFilter` (from `src/app/(dashboard)/profile/actions.ts`);
  `logInteraction` (from `src/app/(dashboard)/contacts/actions.ts`).

- [ ] **Step 1: Write the test**

```typescript
// tests/cross-user-access.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSupabase } from "@/lib/supabase";

let mockUserId: string | null = null;
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mockUserId }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {},
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

const { updateApplicationStatus, deleteApplication } = await import(
  "@/app/(dashboard)/applications/actions"
);
const { deleteSavedFilter, setDefaultFilter } = await import(
  "@/app/(dashboard)/profile/actions"
);
const { logInteraction } = await import("@/app/(dashboard)/contacts/actions");

const OWNER = "test-cross-access-owner";
const ATTACKER = "test-cross-access-attacker";

let applicationId: string;
let savedFilterId: string;
let contactId: string;

beforeAll(async () => {
  const supabase = getSupabase();

  const { data: application } = await supabase
    .from("applications")
    .insert({ user_id: OWNER, role_title: "Test Role", status: "applied", source: "manual" })
    .select("id")
    .single();
  applicationId = application!.id;

  const { data: filter } = await supabase
    .from("saved_filters")
    .insert({ user_id: OWNER, scope: "feed", name: "Test filter" })
    .select("id")
    .single();
  savedFilterId = filter!.id;

  const { data: contact } = await supabase
    .from("contacts")
    .insert({ user_id: OWNER, name: "Test Contact" })
    .select("id")
    .single();
  contactId = contact!.id;
});

afterAll(async () => {
  const supabase = getSupabase();
  await supabase.from("applications").delete().eq("user_id", OWNER);
  await supabase.from("saved_filters").delete().eq("user_id", OWNER);
  await supabase.from("contacts").delete().eq("user_id", OWNER);
});

describe("cross-user access", () => {
  it("cannot update another user's application status", async () => {
    mockUserId = ATTACKER;
    await expect(updateApplicationStatus(applicationId, "offer")).rejects.toThrow(
      "Application not found"
    );
  });

  it("cannot delete another user's application", async () => {
    mockUserId = ATTACKER;
    await deleteApplication(applicationId);

    const { data } = await getSupabase()
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .maybeSingle();
    expect(data).not.toBeNull();
  });

  it("cannot delete another user's saved filter", async () => {
    mockUserId = ATTACKER;
    await deleteSavedFilter(savedFilterId);

    const { data } = await getSupabase()
      .from("saved_filters")
      .select("id")
      .eq("id", savedFilterId)
      .maybeSingle();
    expect(data).not.toBeNull();
  });

  it("cannot set another user's saved filter as default", async () => {
    mockUserId = ATTACKER;
    await setDefaultFilter(savedFilterId, "feed", true);

    const { data } = await getSupabase()
      .from("saved_filters")
      .select("is_default")
      .eq("id", savedFilterId)
      .single();
    expect(data!.is_default).toBe(false);
  });

  it("cannot log an interaction against another user's contact", async () => {
    mockUserId = ATTACKER;
    const formData = new FormData();
    formData.set("type", "email");
    await expect(logInteraction(contactId, "/contacts", formData)).rejects.toThrow(
      "Contact not found"
    );
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- cross-user-access`
Expected: 5 passed. If any fail, that server action has a real
authorization gap — fix the action (add the missing
`.eq("user_id", userId)`) before proceeding; do not weaken the test.

- [ ] **Step 3: Commit**

```bash
git add tests/cross-user-access.test.ts
git commit -m "Add cross-user access regression test"
```

---

### Task 3: Atomic application creation

Fixes the audit's bug: `applyFromPosting` inserts `applications` then
`status_history` as two unwrapped calls — if the second fails, the
application silently vanishes from the funnel chart with no error shown.
`createManualApplication` has the identical two-insert pattern (same root
cause, same fix). Both now call one Postgres function so the two inserts
commit or fail together.

**Files:**
- Create: `supabase/migrations/0014_atomic_application_insert.sql`
- Test: `tests/atomic-application.test.ts`
- Modify: `src/app/(dashboard)/feed/actions.ts:23-60` (`applyFromPosting`)
- Modify: `src/app/(dashboard)/applications/actions.ts:11-46` (`createManualApplication`)

**Interfaces:**
- Produces: Postgres function `create_application_with_history(p_user_id
  text, p_company_id uuid, p_posting_id uuid, p_role_title text, p_role_type
  text, p_is_phd boolean, p_status text default 'applied', p_source text
  default 'feed') returns uuid` — callable via `supabase.rpc(...)`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0014_atomic_application_insert.sql
-- Wraps the applications + status_history insert pair in one transaction
-- (a plpgsql function body is transactional) so a failure on the second
-- insert can't leave an orphaned application that silently disappears from
-- the funnel chart (getApplicationFlow skips zero-history applications).
create or replace function create_application_with_history(
  p_user_id text,
  p_company_id uuid,
  p_posting_id uuid,
  p_role_title text,
  p_role_type text,
  p_is_phd boolean,
  p_status text default 'applied',
  p_source text default 'feed'
) returns uuid
language plpgsql
as $$
declare
  v_application_id uuid;
begin
  insert into applications (user_id, company_id, posting_id, role_title, status, source, role_type, is_phd)
  values (p_user_id, p_company_id, p_posting_id, p_role_title, p_status, p_source, p_role_type, p_is_phd)
  returning id into v_application_id;

  insert into status_history (application_id, status)
  values (v_application_id, p_status);

  return v_application_id;
end;
$$;
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP tool (`mcp__supabase__apply_migration`, name
`atomic_application_insert`) or paste into the Supabase SQL editor — same
as every prior migration (see README's "Setup" section).

- [ ] **Step 3: Write the test**

```typescript
// tests/atomic-application.test.ts
import { describe, expect, it } from "vitest";
import { getSupabase } from "@/lib/supabase";

describe("create_application_with_history RPC", () => {
  it("creates a linked application + status_history row", async () => {
    const supabase = getSupabase();
    const { data: company } = await supabase
      .from("companies")
      .insert({ name: "Test RPC Co", slug: `test-rpc-co-${Date.now()}` })
      .select("id")
      .single();

    const { data: applicationId, error } = await supabase.rpc(
      "create_application_with_history",
      {
        p_user_id: "test-rpc-user",
        p_company_id: company!.id,
        p_posting_id: null,
        p_role_title: "Test Role",
        p_role_type: "internship",
        p_is_phd: false,
      }
    );
    expect(error).toBeNull();

    const { data: history } = await supabase
      .from("status_history")
      .select("status")
      .eq("application_id", applicationId);
    expect(history).toHaveLength(1);
    expect(history![0].status).toBe("applied");

    await supabase.from("applications").delete().eq("id", applicationId);
    await supabase.from("companies").delete().eq("id", company!.id);
  });

  it("rolls back fully when company_id doesn't exist", async () => {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("create_application_with_history", {
      p_user_id: "test-rpc-user-rollback",
      p_company_id: "00000000-0000-0000-0000-000000000000",
      p_posting_id: null,
      p_role_title: "Test Role",
      p_role_type: "internship",
      p_is_phd: false,
    });
    expect(error).not.toBeNull();

    const { data: orphaned } = await supabase
      .from("applications")
      .select("id")
      .eq("user_id", "test-rpc-user-rollback");
    expect(orphaned).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test -- atomic-application`
Expected: 2 passed.

- [ ] **Step 5: Update `applyFromPosting`**

Replace lines 35-54 of `src/app/(dashboard)/feed/actions.ts` (the two
`.insert()` calls) so the function reads:

```typescript
export async function applyFromPosting(postingId: string, returnTo: string) {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`);
  const supabase = getSupabase();

  const { data: posting, error: postingError } = await supabase
    .from("postings")
    .select("company_id, title, role_type, is_phd")
    .eq("id", postingId)
    .single();
  if (postingError) throw postingError;

  const { error: rpcError } = await supabase.rpc("create_application_with_history", {
    p_user_id: userId,
    p_company_id: posting.company_id,
    p_posting_id: postingId,
    p_role_title: posting.title,
    p_role_type: posting.role_type,
    p_is_phd: posting.is_phd,
  });
  if (rpcError) throw rpcError;

  revalidatePath(returnTo);
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  redirect(`${returnTo}?flash=${encodeURIComponent("Application added")}`);
}
```

- [ ] **Step 6: Update `createManualApplication`**

Replace lines 23-41 of `src/app/(dashboard)/applications/actions.ts` (the
two `.insert()` calls) so the function reads:

```typescript
export async function createManualApplication(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  const companyName = String(formData.get("companyName") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim();
  const status = String(formData.get("status") ?? "applied");
  if (!companyName || !roleTitle) throw new Error("Company and role are required");

  const companyId = await findOrCreateCompany(supabase, { name: companyName });

  const { error } = await supabase.rpc("create_application_with_history", {
    p_user_id: userId,
    p_company_id: companyId,
    p_posting_id: null,
    p_role_title: roleTitle,
    p_role_type: inferRoleType(roleTitle),
    p_is_phd: isPhdRole(roleTitle),
    p_status: status,
    p_source: "manual",
  });
  if (error) throw error;

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  redirect(`/applications?flash=${encodeURIComponent("Application added")}`);
}
```

- [ ] **Step 7: Manual verification**

Run the dev server (`npm run dev`), sign in, apply to a posting from
`/feed`, and add a manual application from `/applications`. Confirm both
show up correctly in the funnel chart and application list.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0014_atomic_application_insert.sql tests/atomic-application.test.ts \
  "src/app/(dashboard)/feed/actions.ts" "src/app/(dashboard)/applications/actions.ts"
git commit -m "Make application creation atomic via a Postgres function"
```

---

### Task 4: Harden the sync-postings cron

Two fixes to `src/app/api/sync-postings/route.ts`: a timing-safe secret
comparison (currently a plain `!==`), and a `sync_runs` row written *before*
the sync runs (not only after) so a hard Vercel timeout kill still leaves a
visible "started but never finished" row instead of no trace at all. The
timing-safe check is extracted to a shared helper since Task 12's digest
cron needs the identical check.

**Files:**
- Create: `src/lib/cronAuth.ts`
- Test: `tests/cronAuth.test.ts`
- Modify: `src/app/api/sync-postings/route.ts`

**Interfaces:**
- Produces: `isValidCronRequest(request: Request): boolean` — used by both
  `/api/sync-postings` and (Task 12) `/api/send-digests`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cronAuth.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isValidCronRequest } from "@/lib/cronAuth";

describe("isValidCronRequest", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret-value";
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("accepts the correct bearer token", () => {
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer test-secret-value" },
    });
    expect(isValidCronRequest(request)).toBe(true);
  });

  it("rejects an incorrect token", () => {
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer wrong-value" },
    });
    expect(isValidCronRequest(request)).toBe(false);
  });

  it("rejects a missing header", () => {
    const request = new Request("http://localhost");
    expect(isValidCronRequest(request)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- cronAuth`
Expected: FAIL — `Cannot find module '@/lib/cronAuth'`.

- [ ] **Step 3: Implement `src/lib/cronAuth.ts`**

```typescript
import { timingSafeEqual } from "crypto";

// Timing-safe compare so response latency can't leak how many leading
// characters of CRON_SECRET a guess got right. Shared by every cron route
// (sync-postings, send-digests) instead of each doing its own `!==` check.
export function isValidCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/, "");

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length === 0 || expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- cronAuth`
Expected: 3 passed.

- [ ] **Step 5: Update `src/app/api/sync-postings/route.ts`**

Replace the whole file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { syncAllPostings } from "@/lib/scrapers/sync";
import { syncCommunityListings } from "@/lib/scrapers/community";
import { checkStaleLinks } from "@/lib/scrapers/linkcheck";
import { getSupabase } from "@/lib/supabase";
import { isValidCronRequest } from "@/lib/cronAuth";

// Scraping ~100+ companies plus link-health checks can run past the
// platform's default function timeout — cap set to the Hobby-tier ceiling.
export const maxDuration = 60;

// Vercel Cron (see vercel.json) invokes this via GET, automatically adding
// `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set in the
// project's environment variables. POST is kept for manual/local triggering
// with the same header.
async function runSync(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const startedAt = new Date().toISOString();

  // Inserted before the run (not only after it finishes) so a hard Vercel
  // timeout kill still leaves a "started, never finished" row visible in
  // /admin/reports instead of no trace of the run at all.
  const { data: runRow, error: insertError } = await supabase
    .from("sync_runs")
    .insert({ started_at: startedAt })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const [results, community, linkHealth] = await Promise.all([
    syncAllPostings().catch((err) => [{ error: err.message }]),
    syncCommunityListings().catch((err) => ({ source: "community:vanshb03", error: err.message })),
    checkStaleLinks().catch((err) => ({ error: err.message })),
  ]);

  await supabase
    .from("sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      companies_ok: results.filter((r) => !("error" in r)).length,
      companies_failed: results.filter((r) => "error" in r).length,
      community_synced: "synced" in community ? community.synced : null,
      link_checked: "checked" in linkHealth ? linkHealth.checked : null,
      link_dead: "dead" in linkHealth ? linkHealth.dead : null,
    })
    .eq("id", runRow.id);

  return NextResponse.json({ results, community, linkHealth });
}

export const GET = runSync;
export const POST = runSync;
```

- [ ] **Step 6: Manual verification**

Run: `CRON_SECRET=<value from .env.local> curl -X POST http://localhost:3000/api/sync-postings -H "Authorization: Bearer $CRON_SECRET"`
While it's running, check the `sync_runs` table (via the Supabase
dashboard or `mcp__supabase__execute_sql`) and confirm a row with
`finished_at: null` appears immediately, then fills in once the request
completes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cronAuth.ts tests/cronAuth.test.ts src/app/api/sync-postings/route.ts
git commit -m "Harden sync-postings cron: timing-safe auth, visible timeout failures"
```

---

### Task 5: Subscriptions + digest schema

**Files:**
- Create: `supabase/migrations/0015_subscriptions_and_digest.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0015_subscriptions_and_digest.sql
-- Paid-tier entitlements. No row = free tier; only paid subscribers get
-- one. Never queried from a client component (only getUserTier via the
-- service-role client), so no RLS needed.
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  tier text not null check (tier in ('plus', 'pro')),
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_stripe_customer_id_idx on subscriptions (stripe_customer_id);

-- Email digest preferences, extending the existing per-user preferences row.
alter table user_preferences
  add column digest_enabled boolean not null default false,
  add column digest_cadence text not null default 'daily' check (digest_cadence in ('daily', 'weekly')),
  add column digest_last_sent_at timestamptz;
```

- [ ] **Step 2: Apply the migration**

Apply via `mcp__supabase__apply_migration` (name
`subscriptions_and_digest`) or the Supabase SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_subscriptions_and_digest.sql
git commit -m "Add subscriptions table and digest preference columns"
```

---

### Task 6: `getUserTier` / `tierAtLeast`

**Files:**
- Create: `src/lib/subscriptions.ts`
- Test: `tests/subscriptions.test.ts`

**Interfaces:**
- Produces: `type Tier = "free" | "plus" | "pro"`;
  `getUserTier(supabase: SupabaseClient, userId: string): Promise<Tier>`;
  `tierAtLeast(tier: Tier, minimum: Tier): boolean`. Every later feature
  gate (checkout, portal, digest toggle, digest cron) imports these.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/subscriptions.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { getSupabase } from "@/lib/supabase";
import { getUserTier, tierAtLeast } from "@/lib/subscriptions";

describe("tierAtLeast", () => {
  it("free does not meet plus", () => {
    expect(tierAtLeast("free", "plus")).toBe(false);
  });

  it("pro meets plus", () => {
    expect(tierAtLeast("pro", "plus")).toBe(true);
  });

  it("plus meets plus", () => {
    expect(tierAtLeast("plus", "plus")).toBe(true);
  });
});

describe("getUserTier", () => {
  const userId = "test-subscriptions-user";

  afterEach(async () => {
    await getSupabase().from("subscriptions").delete().eq("user_id", userId);
  });

  it("returns free when no subscription row exists", async () => {
    expect(await getUserTier(getSupabase(), "no-such-user")).toBe("free");
  });

  it("returns the tier when status is active", async () => {
    await getSupabase().from("subscriptions").insert({
      user_id: userId,
      stripe_customer_id: `cus_test_${Date.now()}`,
      tier: "plus",
      status: "active",
    });
    expect(await getUserTier(getSupabase(), userId)).toBe("plus");
  });

  it("returns free when status is canceled", async () => {
    await getSupabase().from("subscriptions").insert({
      user_id: userId,
      stripe_customer_id: `cus_test_${Date.now()}`,
      tier: "pro",
      status: "canceled",
    });
    expect(await getUserTier(getSupabase(), userId)).toBe("free");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- subscriptions`
Expected: FAIL — `Cannot find module '@/lib/subscriptions'`.

- [ ] **Step 3: Implement `src/lib/subscriptions.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "plus" | "pro";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const TIER_ORDER: Tier[] = ["free", "plus", "pro"];

// One place every feature gate calls — "is this user Plus or Pro" is a
// single function call, not a scattered Stripe lookup. No row (or a row
// whose status has lapsed) means free tier.
export async function getUserTier(supabase: SupabaseClient, userId: string): Promise<Tier> {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !ACTIVE_STATUSES.has(data.status)) return "free";
  return data.tier as Tier;
}

export function tierAtLeast(tier: Tier, minimum: Tier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- subscriptions`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscriptions.ts tests/subscriptions.test.ts
git commit -m "Add getUserTier/tierAtLeast entitlement helpers"
```

---

### Task 7: Stripe SDK, env vars, Dashboard setup

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install the Stripe SDK**

```bash
npm install stripe
```

- [ ] **Step 2: Create Products and Prices in the Stripe Dashboard**

In the Stripe Dashboard (test mode) → Product catalog → create two
products:
- "Casefile Plus" with two recurring Prices: $1.99/month, $19.00/year.
- "Casefile Pro" with two recurring Prices: $9.99/month, $99.00/year
  (created now for schema completeness even though Pro ships later — the
  price IDs cost nothing to reserve).

Copy each Price's ID (`price_...`).

- [ ] **Step 3: Create a webhook endpoint in the Stripe Dashboard**

Developers → Webhooks → add endpoint. For local development use the
Stripe CLI instead (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`,
covered in Task 9's manual verification) — the CLI prints a signing secret
for local use; the Dashboard endpoint (pointing at
`https://<your-domain>/api/webhooks/stripe`) is for production and has its
own separate signing secret. Subscribe both to: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`.

- [ ] **Step 4: Add the new env vars to `.env.example`**

Append:

```
# Stripe — https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=
# Stripe CLI (local) or Dashboard webhook endpoint (production) signing secret
STRIPE_WEBHOOK_SIGNING_SECRET=
# Price IDs from the Stripe Dashboard's Product catalog
STRIPE_PRICE_PLUS_MONTHLY=
STRIPE_PRICE_PLUS_ANNUAL=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_ANNUAL=
```

- [ ] **Step 5: Fill in the real values in `.env.local`**

Copy the six values from Steps 2-3 into your own `.env.local` (never
committed).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "Add Stripe SDK and env var scaffolding"
```

---

### Task 8: Checkout + `/pricing` page

**Files:**
- Create: `src/lib/stripe.ts`
- Create: `src/app/pricing/actions.ts`
- Create: `src/app/pricing/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx` (nav link, see Task 13)

**Interfaces:**
- Consumes: `getUserTier`/`tierAtLeast` from `@/lib/subscriptions`.
- Produces: `getStripe(): Stripe`; server action
  `createCheckoutSession(priceId: string): never` (always redirects).

- [ ] **Step 1: Implement `src/lib/stripe.ts`**

```typescript
import Stripe from "stripe";

// Lazy singleton, same pattern as src/lib/supabase.ts — importing this
// file shouldn't throw at build time before STRIPE_SECRET_KEY is set.
let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}
```

- [ ] **Step 2: Implement `src/app/pricing/actions.ts`**

```typescript
"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

export async function createCheckoutSession(priceId: string) {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-up?redirect_url=${encodeURIComponent("/pricing")}`);

  const stripe = getStripe();
  const supabase = getSupabase();

  // Reuse an existing Stripe customer if this user already has one (e.g.
  // switching plans), so Stripe doesn't fragment one person across
  // multiple customer records.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existing?.stripe_customer_id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/pricing?flash=${encodeURIComponent("Subscription active — welcome!")}`,
    cancel_url: `${siteUrl}/pricing?flash=${encodeURIComponent("Checkout canceled")}`,
    // Carried onto the Subscription object itself (not just this session),
    // so every later webhook event — not only checkout.session.completed —
    // can resolve which Casefile user this Stripe subscription belongs to.
    subscription_data: { metadata: { user_id: userId } },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  redirect(session.url);
}
```

- [ ] **Step 3: Implement `src/app/pricing/page.tsx`**

```typescript
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { getUserTier } from "@/lib/subscriptions";
import { Flash } from "@/components/Flash";
import { createCheckoutSession } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing — Casefile" };

const PLANS = [
  {
    tier: "plus" as const,
    name: "Plus",
    price: "$1.99/mo",
    annualPrice: "$19/yr",
    monthlyPriceId: process.env.STRIPE_PRICE_PLUS_MONTHLY!,
    annualPriceId: process.env.STRIPE_PRICE_PLUS_ANNUAL!,
    blurb: "Get emailed when new postings match your saved feed filter.",
  },
  {
    tier: "pro" as const,
    name: "Pro",
    price: "$9.99/mo",
    annualPrice: "$99/yr",
    monthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    annualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL!,
    blurb: "Everything in Plus, plus AI-parsed application-status emails. Coming soon.",
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const { userId } = await auth();
  const currentTier = userId ? await getUserTier(getSupabase(), userId) : "free";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
        ← Back to Casefile
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">Pricing</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Casefile stays free forever. These are optional add-ons.
      </p>

      <Flash message={flash} />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div key={plan.tier} className="rounded-xl border border-paper-line p-6">
            <h2 className="font-display text-xl font-semibold text-ink">{plan.name}</h2>
            <p className="mt-2 text-sm text-ink-soft">{plan.blurb}</p>
            <p className="mt-4 font-display text-2xl font-semibold text-ink">{plan.price}</p>
            <p className="text-xs text-ink-soft">or {plan.annualPrice} billed annually</p>

            {currentTier === plan.tier ? (
              <p className="mt-6 text-sm font-medium text-status-offer">Current plan</p>
            ) : plan.tier === "pro" ? (
              <button
                type="button"
                disabled
                className="mt-6 w-full rounded-full border border-paper-line px-4 py-2 text-sm font-medium text-ink-soft"
              >
                Coming soon
              </button>
            ) : (
              <form action={createCheckoutSession.bind(null, plan.annualPriceId)}>
                <button
                  type="submit"
                  className="mt-6 w-full rounded-full border border-paper-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-soft"
                >
                  Subscribe annually
                </button>
              </form>
            )}
            {currentTier !== plan.tier && plan.tier === "plus" && (
              <form action={createCheckoutSession.bind(null, plan.monthlyPriceId)}>
                <button
                  type="submit"
                  className="mt-2 w-full text-xs font-medium text-ink-soft hover:text-ink hover:underline"
                >
                  or pay monthly instead
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, sign in, visit `/pricing`, click "Subscribe annually"
under Plus. Confirm it redirects to a real Stripe Checkout page showing
the $19/yr price (full webhook flow is verified in Task 9).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe.ts src/app/pricing
git commit -m "Add /pricing page and Stripe Checkout action"
```

---

### Task 9: Stripe webhook

**Files:**
- Create: `src/lib/stripeSubscriptionSync.ts`
- Test: `tests/stripe-webhook.test.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Produces: `upsertFromSubscription(subscription: Stripe.Subscription):
  Promise<void>` — used by the webhook route and directly by the test
  (kept out of `route.ts` itself since Next.js route files only expect
  HTTP-method exports).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/stripe-webhook.test.ts
import { afterEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { getSupabase } from "@/lib/supabase";
import { upsertFromSubscription } from "@/lib/stripeSubscriptionSync";

function fakeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: "sub_test_123",
    customer: "cus_test_123",
    status: "active",
    current_period_end: Math.floor(Date.now() / 1000) + 86400,
    metadata: { user_id: "test-webhook-user" },
    items: { data: [{ price: { id: process.env.STRIPE_PRICE_PLUS_MONTHLY } }] },
    ...overrides,
  } as Stripe.Subscription;
}

describe("upsertFromSubscription", () => {
  afterEach(async () => {
    await getSupabase().from("subscriptions").delete().eq("user_id", "test-webhook-user");
  });

  it("creates a subscriptions row from an active subscription", async () => {
    await upsertFromSubscription(fakeSubscription());
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("tier, status")
      .eq("user_id", "test-webhook-user")
      .single();
    expect(data!.tier).toBe("plus");
    expect(data!.status).toBe("active");
  });

  it("marks status canceled on a deleted subscription event", async () => {
    await upsertFromSubscription(fakeSubscription());
    await upsertFromSubscription(fakeSubscription({ status: "canceled" }));
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("status")
      .eq("user_id", "test-webhook-user")
      .single();
    expect(data!.status).toBe("canceled");
  });

  it("ignores a subscription with no user_id metadata", async () => {
    await upsertFromSubscription(fakeSubscription({ metadata: {}, customer: "cus_test_orphan" }));
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("id")
      .eq("stripe_customer_id", "cus_test_orphan");
    expect(data).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- stripe-webhook`
Expected: FAIL — `Cannot find module '@/lib/stripeSubscriptionSync'`. (Also
confirm `STRIPE_PRICE_PLUS_MONTHLY` is set in `.env.local` from Task 7,
Step 5 — the test relies on it matching a real "plus" price.)

- [ ] **Step 3: Implement `src/lib/stripeSubscriptionSync.ts`**

```typescript
import type Stripe from "stripe";
import { getSupabase } from "@/lib/supabase";

const PRICE_TO_TIER: Record<string, "plus" | "pro"> = {
  [process.env.STRIPE_PRICE_PLUS_MONTHLY ?? ""]: "plus",
  [process.env.STRIPE_PRICE_PLUS_ANNUAL ?? ""]: "plus",
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""]: "pro",
  [process.env.STRIPE_PRICE_PRO_ANNUAL ?? ""]: "pro",
};

// Called for checkout.session.completed (after retrieving the full
// subscription), customer.subscription.updated, and
// customer.subscription.deleted — all three carry a full Stripe
// Subscription object with the same shape, so one function handles all
// three event types.
export async function upsertFromSubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata.user_id;
  if (!userId) return; // not one of ours — defensive, shouldn't happen

  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? PRICE_TO_TIER[priceId] : undefined;
  if (!tier) return;

  const supabase = getSupabase();
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      tier,
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- stripe-webhook`
Expected: 3 passed.

- [ ] **Step 5: Implement `src/app/api/webhooks/stripe/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { upsertFromSubscription } from "@/lib/stripeSubscriptionSync";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature ?? "",
      process.env.STRIPE_WEBHOOK_SIGNING_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      await upsertFromSubscription(subscription);
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await upsertFromSubscription(event.data.object as Stripe.Subscription);
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 6: Manual verification with the Stripe CLI**

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the signing secret it prints into `.env.local`'s
`STRIPE_WEBHOOK_SIGNING_SECRET`, restart `npm run dev`, then in another
terminal:

```bash
stripe trigger checkout.session.completed
```

Check the `subscriptions` table (Supabase dashboard or
`mcp__supabase__execute_sql`) for a new row. Then walk through the real
flow end to end: `/pricing` → Checkout (use Stripe's test card
`4242 4242 4242 4242`) → redirected back to `/pricing` with the success
flash → confirm the row now reflects your actual test user's Clerk
`userId`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stripeSubscriptionSync.ts tests/stripe-webhook.test.ts src/app/api/webhooks/stripe
git commit -m "Add Stripe webhook handler syncing subscriptions table"
```

---

### Task 10: Customer portal + profile subscription UI

**Files:**
- Modify: `src/app/pricing/actions.ts` (add `createPortalSession`)
- Modify: `src/app/(dashboard)/profile/page.tsx`

**Interfaces:**
- Consumes: `getUserTier` from `@/lib/subscriptions`.
- Produces: server action `createPortalSession(): never` (always redirects).

- [ ] **Step 1: Add `createPortalSession` to `src/app/pricing/actions.ts`**

Append to the file:

```typescript
export async function createPortalSession() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = getSupabase();
  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) redirect("/pricing");

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${siteUrl}/profile`,
  });
  redirect(session.url);
}
```

- [ ] **Step 2: Add a subscription section to `/profile`**

In `src/app/(dashboard)/profile/page.tsx`, add the import and fetch the
tier near the top of the component (alongside the existing
`getUserPreferences` call), then render a new section. The page currently
starts:

```typescript
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { Flash } from "@/components/Flash";
```

Add:

```typescript
import { getUserTier } from "@/lib/subscriptions";
import { createPortalSession } from "@/app/pricing/actions";
```

Inside the page component, alongside the existing `auth()` and
`getSupabase()` calls, add:

```typescript
const tier = await getUserTier(supabase, userId);
```

Then render this section (placed right after the page's existing header,
before the saved-filter sections):

```typescript
<section className="mt-10 rounded-xl border border-paper-line p-6">
  <h2 className="font-display text-lg font-semibold text-ink">Subscription</h2>
  {tier === "free" ? (
    <>
      <p className="mt-2 text-sm text-ink-soft">
        You're on the free plan. Upgrade to Plus for an email digest of new
        postings matching your saved filter.
      </p>
      <Link
        href="/pricing"
        className="mt-4 inline-block rounded-full border border-paper-line px-4 py-1.5 text-sm font-medium text-ink hover:border-ink-soft"
      >
        See plans
      </Link>
    </>
  ) : (
    <>
      <p className="mt-2 text-sm text-ink-soft">
        Current plan: <span className="font-medium text-ink">{tier === "pro" ? "Pro" : "Plus"}</span>
      </p>
      <form action={createPortalSession}>
        <button
          type="submit"
          className="mt-4 rounded-full border border-paper-line px-4 py-1.5 text-sm font-medium text-ink hover:border-ink-soft"
        >
          Manage subscription
        </button>
      </form>
    </>
  )}
</section>
```

This requires a `Link` import from `next/link` if not already present —
check the top of the file and add it if missing.

- [ ] **Step 3: Manual verification**

Sign in as a user with no subscription row — confirm `/profile` shows
"You're on the free plan" and a working "See plans" link. Complete a test
checkout (Task 9, Step 6), reload `/profile`, confirm it now shows
"Current plan: Plus" and "Manage subscription" opens a real Stripe
Billing Portal page.

- [ ] **Step 4: Commit**

```bash
git add src/app/pricing/actions.ts "src/app/(dashboard)/profile/page.tsx"
git commit -m "Add Stripe customer portal and subscription status to /profile"
```

---

### Task 11: Digest preferences (data layer + UI)

**Files:**
- Modify: `src/lib/preferences.ts`
- Modify: `src/app/(dashboard)/profile/actions.ts` (add `updateDigestPreferences`)
- Modify: `src/app/(dashboard)/profile/page.tsx`

**Interfaces:**
- Produces: `UserPreferences.digestEnabled: boolean`,
  `UserPreferences.digestCadence: "daily" | "weekly"` on the existing
  `getUserPreferences` return type; server action
  `updateDigestPreferences(formData: FormData)`.

- [ ] **Step 1: Extend `src/lib/preferences.ts`**

Update the `UserPreferences` type and `DEFAULT_PREFERENCES`:

```typescript
export type UserPreferences = {
  dailyGoal: number;
  school: string | null;
  major: string | null;
  experience: string | null;
  resumeUrl: string | null;
  coverLetterUrl: string | null;
  digestEnabled: boolean;
  digestCadence: "daily" | "weekly";
};

const DEFAULT_PREFERENCES: UserPreferences = {
  dailyGoal: 1,
  school: null,
  major: null,
  experience: null,
  resumeUrl: null,
  coverLetterUrl: null,
  digestEnabled: false,
  digestCadence: "daily",
};
```

Update `getUserPreferences`'s select and return to include the two new
columns:

```typescript
export async function getUserPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPreferences> {
  const { data } = await supabase
    .from("user_preferences")
    .select(
      "daily_goal, school, major, experience, resume_url, cover_letter_url, digest_enabled, digest_cadence"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_PREFERENCES;
  return {
    dailyGoal: data.daily_goal,
    school: data.school,
    major: data.major,
    experience: data.experience,
    resumeUrl: data.resume_url,
    coverLetterUrl: data.cover_letter_url,
    digestEnabled: data.digest_enabled,
    digestCadence: data.digest_cadence,
  };
}
```

- [ ] **Step 2: Add `updateDigestPreferences` to `src/app/(dashboard)/profile/actions.ts`**

Add the import at the top:

```typescript
import { getUserTier, tierAtLeast } from "@/lib/subscriptions";
```

Append the action:

```typescript
export async function updateDigestPreferences(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const supabase = getSupabase();

  // Re-check tier server-side — the UI only shows this form to Plus/Pro
  // users, but a direct POST shouldn't be able to bypass that.
  const tier = await getUserTier(supabase, userId);
  if (!tierAtLeast(tier, "plus")) throw new Error("Requires a Plus subscription");

  const digestEnabled = formData.get("digestEnabled") === "on";
  const digestCadence = String(formData.get("digestCadence") ?? "daily");
  if (digestCadence !== "daily" && digestCadence !== "weekly") throw new Error("Invalid cadence");

  if (digestEnabled) {
    const { data: defaultFilter } = await supabase
      .from("saved_filters")
      .select("id")
      .eq("user_id", userId)
      .eq("scope", "feed")
      .eq("is_default", true)
      .maybeSingle();
    if (!defaultFilter) {
      throw new Error("Set a default feed filter below before enabling the digest");
    }
  }

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      digest_enabled: digestEnabled,
      digest_cadence: digestCadence,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;

  revalidatePath("/profile");
  redirect(`/profile?flash=${encodeURIComponent(digestEnabled ? "Digest enabled" : "Digest updated")}`);
}
```

- [ ] **Step 3: Add the digest form to `/profile`**

In `src/app/(dashboard)/profile/page.tsx`, import
`updateDigestPreferences` alongside the other action imports, fetch
preferences with `getUserPreferences(supabase, userId)` (if not already
fetched on this page — check the existing top of the file), and add this
section directly after the Subscription section from Task 10 (only
rendered for Plus/Pro):

```typescript
{tierAtLeast(tier, "plus") && (
  <section className="mt-10">
    <h2 className="font-display text-lg font-semibold text-ink">Email digest</h2>
    <p className="mt-2 text-sm text-ink-soft">
      Requires a default feed filter (set one below) — the digest emails
      whatever that filter would show, since your last send.
    </p>
    <form action={updateDigestPreferences} className="mt-4 flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="digestEnabled"
          defaultChecked={preferences.digestEnabled}
          className="h-4 w-4"
        />
        Enabled
      </label>
      <select
        name="digestCadence"
        defaultValue={preferences.digestCadence}
        className="rounded-md border border-paper-line px-3 py-1.5 text-sm"
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly (Mondays)</option>
      </select>
      <button
        type="submit"
        className="rounded-full border border-paper-line px-4 py-1.5 text-sm font-medium text-ink hover:border-ink-soft"
      >
        Save
      </button>
    </form>
  </section>
)}
```

This requires `tierAtLeast` imported (already added in Task 10's import
line — extend it to `import { getUserTier, tierAtLeast } from
"@/lib/subscriptions";` if Task 10 only imported `getUserTier`) and a
`preferences` variable in scope from `getUserPreferences`.

- [ ] **Step 4: Manual verification**

As a Plus test user with a default feed filter set, enable the digest
(daily), confirm the flash message and that reloading the page shows the
checkbox still checked. Try enabling it with no default filter set first
(remove the default via the existing saved-filters UI) — confirm it
throws "Set a default feed filter below before enabling the digest" as a
crash (this codebase doesn't have a try/catch-to-flash wrapper yet, so it
surfaces via the generic error page — acceptable for now, matches the rest
of the app's current error-handling convention).

- [ ] **Step 5: Commit**

```bash
git add src/lib/preferences.ts "src/app/(dashboard)/profile/actions.ts" "src/app/(dashboard)/profile/page.tsx"
git commit -m "Add digest preferences to /profile"
```

---

### Task 12: Digest send cron

**Files:**
- Create: `src/lib/digest.ts`
- Test: `tests/digest.test.ts`
- Create: `src/lib/postmarkBatch.ts`
- Create: `src/app/api/send-digests/route.ts`

**Interfaces:**
- Consumes: `pool` from `@/lib/pool`; `applyPostingFilters` from
  `@/lib/postingFilters`; `isValidCronRequest` from `@/lib/cronAuth`.
- Produces: `isDigestDue(cadence: "daily" | "weekly", isMonday: boolean):
  boolean`; `sendDigestBatch(emails: DigestEmail[]): Promise<void>`.

- [ ] **Step 1: Write the failing test for the cadence rule**

```typescript
// tests/digest.test.ts
import { describe, expect, it } from "vitest";
import { isDigestDue } from "@/lib/digest";

describe("isDigestDue", () => {
  it("daily is always due", () => {
    expect(isDigestDue("daily", false)).toBe(true);
    expect(isDigestDue("daily", true)).toBe(true);
  });

  it("weekly is due only on Monday", () => {
    expect(isDigestDue("weekly", true)).toBe(true);
    expect(isDigestDue("weekly", false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- digest`
Expected: FAIL — `Cannot find module '@/lib/digest'`.

- [ ] **Step 3: Implement `src/lib/digest.ts`**

```typescript
// Weekly digests fire on a fixed day (Monday) rather than each user's
// signup-anniversary day — keeps the due-check a pure function of "today"
// instead of per-user state.
export function isDigestDue(cadence: "daily" | "weekly", isMonday: boolean): boolean {
  return cadence === "daily" || (cadence === "weekly" && isMonday);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- digest`
Expected: 2 passed.

- [ ] **Step 5: Implement `src/lib/postmarkBatch.ts`**

```typescript
import { pool } from "@/lib/pool";

export type DigestEmail = { to: string; subject: string; textBody: string };

// Postmark's batch endpoint accepts up to 500 messages per call — chunk
// through the existing worker-pool pattern instead of looping one fetch
// per subscriber, which is what times out as subscriber count grows.
const POSTMARK_BATCH_LIMIT = 500;
const CHUNK_CONCURRENCY = 4;

export async function sendDigestBatch(emails: DigestEmail[]): Promise<void> {
  const { POSTMARK_SERVER_TOKEN, POSTMARK_FROM_EMAIL } = process.env;
  if (!POSTMARK_SERVER_TOKEN || !POSTMARK_FROM_EMAIL || emails.length === 0) return;

  const chunks: DigestEmail[][] = [];
  for (let i = 0; i < emails.length; i += POSTMARK_BATCH_LIMIT) {
    chunks.push(emails.slice(i, i + POSTMARK_BATCH_LIMIT));
  }

  await pool(chunks, CHUNK_CONCURRENCY, async (chunk) => {
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
  });
}
```

- [ ] **Step 6: Implement `src/app/api/send-digests/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { isValidCronRequest } from "@/lib/cronAuth";
import { applyPostingFilters } from "@/lib/postingFilters";
import { isDigestDue } from "@/lib/digest";
import { sendDigestBatch, type DigestEmail } from "@/lib/postmarkBatch";

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
  const sentUserIds: string[] = [];

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
      (p) => `${p.company.name} — ${p.title} (${p.location})\n${p.url}`
    );
    emails.push({
      to: email,
      subject: `${postings.length} new posting${postings.length === 1 ? "" : "s"} matching your filter`,
      textBody: lines.join("\n\n"),
    });
    sentUserIds.push(prefs.user_id);
  }

  await sendDigestBatch(emails);

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
```

- [ ] **Step 7: Manual verification**

As a Plus test user with `digest_enabled=true`, a default feed filter,
and a real email on your Clerk test account, run:

```bash
curl -X POST http://localhost:3000/api/send-digests -H "Authorization: Bearer $CRON_SECRET"
```

Confirm the response shows `{"sent": 1}` (or more), the email arrives,
and `user_preferences.digest_last_sent_at` for your test user updated in
the DB. Run it a second time immediately after — confirm `{"sent": 0}`
since there are no new postings since the watermark.

- [ ] **Step 8: Commit**

```bash
git add src/lib/digest.ts tests/digest.test.ts src/lib/postmarkBatch.ts src/app/api/send-digests
git commit -m "Add digest send cron using Postmark batch API"
```

---

### Task 13: Wire up nav, cron schedule, final pass

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `vercel.json`

- [ ] **Step 1: Add "Pricing" to both nav link arrays**

In `src/app/(dashboard)/layout.tsx`, update both arrays:

```typescript
const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/feed", label: "Feed" },
  { href: "/companies", label: "Companies" },
  { href: "/applications", label: "Applications" },
  { href: "/contacts", label: "Contacts" },
  { href: "/profile", label: "Profile" },
  { href: "/pricing", label: "Pricing" },
];

const PUBLIC_NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/companies", label: "Companies" },
  { href: "/pricing", label: "Pricing" },
];
```

- [ ] **Step 2: Add the digest cron to `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/sync-postings", "schedule": "0 13 * * *" },
    { "path": "/api/send-digests", "schedule": "0 14 * * *" }
  ]
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass (smoke, cronAuth, cross-user-access,
atomic-application, subscriptions, stripe-webhook, digest).

- [ ] **Step 4: Full manual walkthrough**

1. `npm run dev`, sign in as a fresh test user with no subscription.
2. `/pricing` → subscribe to Plus (annual) with test card `4242 4242 4242 4242`.
3. Redirected back with the success flash; `/profile` shows "Current plan: Plus".
4. Set a default feed filter on `/profile`, then enable the digest (daily).
5. Trigger `/api/send-digests` manually (Task 12, Step 3) — confirm the email arrives.
6. `/profile` → "Manage subscription" → cancel in the Stripe portal.
7. Confirm the `customer.subscription.deleted` webhook fires (visible in
   `stripe listen`'s terminal output) and `/profile` reverts to showing
   the free-plan CTA.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx" vercel.json
git commit -m "Add pricing nav link and digest cron schedule"
```

---

## Deferred to the Pro-tier plan (not this plan)

Per the spec's phased rollout, the following are explicitly out of scope
here and will be planned separately once Plus has shipped and been
validated: the `/api/inbound-email` Postmark→Groq pipeline, the per-user
review-queue UI on `/applications`, and Pro-tier gating logic (though the
Pro Stripe Price IDs and `PRICE_TO_TIER` mapping created in Task 7/9
already support it — no rework needed there when that plan begins).
