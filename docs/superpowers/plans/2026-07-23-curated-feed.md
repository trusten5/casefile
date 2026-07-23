# Curated Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "today's finds" section to the daily draft email — 5 real headlines/tweets pulled from the web, source material for a manual meme/joke post, never auto-generated into one.

**Architecture:** One new module (`curatedFeed.ts`) calls Claude's server-side web search tool the same way `generateCopy.ts` already calls the Messages API. `generate.ts` calls it once at the end of its pillar loop and appends the raw text to `reviewLines`, soft-failing the same way the existing stats/copy calls in that loop already do.

**Tech Stack:** TypeScript, `tsx`, Anthropic Messages API (`fetch`, no SDK — matches `generateCopy.ts`), Vitest.

## Global Constraints

- Reuse the existing `ANTHROPIC_API_KEY` — no new credential, no new dependency.
- No AI-authored meme/joke pillar — this only surfaces source material.
- No dedup/history storage for these items (unlike `history.ts`'s per-pillar hooks) — sourced fresh every run.
- No structured schema / forced tool-use — plain text, 5 lines, format `<headline or tweet text> — <URL>`, nothing else.
- Recency: last 24-48 hours only.
- Scope: job search, careers, college, tech, finance, interviews, corporate/business/VC trends.
- Tone: no political siding, but relevant legislation/policy announcements are fair game; on-topic controversy is fine, off-topic controversy is not.
- No changes to `render.ts`, `sendEmail.ts`, `draft.json`'s shape, the `content_drafts` Supabase mirror, or either plist.
- Failure must never block the rest of the batch — same soft-fail try/catch pattern already used for `stats`/`generateCopy` failures in `generate.ts`.

---

### Task 1: `curatedFeed.ts` module

**Files:**
- Create: `scripts/content-engine/curatedFeed.ts`
- Modify (test): `tests/content-engine.test.ts`

**Interfaces:**
- Produces: `export async function getCuratedFeed(): Promise<string>` — resolves to the 5-line plain-text block described in Global Constraints, or throws on any API failure (network, missing key, non-2xx response, missing text block).

- [ ] **Step 1: Write the test**

Add this import near the top of `tests/content-engine.test.ts` (alongside the existing `getContentStats`/`renderSlide` imports):

```ts
import { getCuratedFeed } from "../scripts/content-engine/curatedFeed";
```

Add this new `describe` block at the end of the file:

```ts
describe("getCuratedFeed", () => {
  it("returns 5 lines of real text with links, sourced live", async () => {
    const feed = await getCuratedFeed();

    expect(typeof feed).toBe("string");
    expect(feed.length).toBeGreaterThan(0);
    expect(feed).toMatch(/https?:\/\//);
  }, 30000);
});
```

The `30000` is a per-test timeout override (the file's global default is 15000ms in `vitest.config.ts`) — a web-search-augmented Claude call can run multiple searches server-side before returning, and 15s cut it close in manual testing.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- content-engine`
Expected: FAIL — `Cannot find module '../scripts/content-engine/curatedFeed'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `curatedFeed.ts`**

Create `scripts/content-engine/curatedFeed.ts`:

```ts
// Finds real headlines/tweets from the last 24-48h as source material for a
// possible manual meme/joke post — this never writes the post itself, and
// nothing here is auto-turned into draft.json/a rendered slide.
const MODEL = process.env.CONTENT_ENGINE_MODEL || "claude-sonnet-5";

export async function getCuratedFeed(): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const system = `Find 5 real, genuinely interesting/funny/crazy headlines or tweets from the last 24-48 hours, for a person to manually consider turning into a joke/meme-style social post. You are only finding source material — do not write a post, caption, or joke yourself.

Scope: job search, careers, college, tech, finance, interviews, corporate/business/VC trends. Examples of the kind of thing that fits: "[company] revolutionizes interview process," a wild VC/business trend, a new hiring-by-degree report, colleges ranked by starting salary.

Recency: only the last 24-48 hours.

Tone: don't pick sides politically, but a bill passing or a politician announcing something that hits these topic areas is fair game. Controversy is fine as long as it's on-topic — don't chase controversy that's unrelated to these topics.

Output format: respond with EXACTLY 5 lines, nothing else — no intro, no numbering explanation, no ranking rationale. Each line: <the headline or tweet text> — <URL>`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: "Find today's 5 items." }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const textBlocks = (body.content ?? []).filter((block: { type: string }) => block.type === "text");
  const last = textBlocks[textBlocks.length - 1];
  if (!last) throw new Error("No text block in Claude response");
  return last.text as string;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- content-engine`
Expected: PASS (this makes one real, billed Anthropic API call with web search — that's expected and matches how `getContentStats`'s test already hits the real DB).

- [ ] **Step 5: Commit**

```bash
git add scripts/content-engine/curatedFeed.ts tests/content-engine.test.ts
git commit -m "Add curatedFeed module for daily draft-email content finds"
```

---

### Task 2: Wire into `generate.ts`

**Files:**
- Modify: `scripts/content-engine/generate.ts`

**Interfaces:**
- Consumes: `getCuratedFeed(): Promise<string>` from Task 1.

- [ ] **Step 1: Add the import**

In `scripts/content-engine/generate.ts`, add to the existing import block (after the `recentHooks, recordHook` import):

```ts
import { getCuratedFeed } from "./curatedFeed";
```

- [ ] **Step 2: Append the curated-feed section after the pillar loop**

The pillar `for` loop currently ends like this (last lines of the loop body, right before `mkdirSync(batchDir, ...)`):

```ts
    console.log(`[${label}] done — ${post.slides.length} slides`);
  }

  mkdirSync(batchDir, { recursive: true });
```

Change it to:

```ts
    console.log(`[${label}] done — ${post.slides.length} slides`);
  }

  try {
    const feed = await getCuratedFeed();
    reviewLines.push("## Today's finds (not auto-posted — yours to look into)", feed, "");
  } catch (err) {
    console.error("Curated feed fetch failed, skipping:", err);
    reviewLines.push("## Today's finds — SKIPPED (fetch failed)\n");
  }

  mkdirSync(batchDir, { recursive: true });
```

- [ ] **Step 3: Verify with a typecheck — do NOT run `generate.ts`'s `main()` today**

Run: `npx tsc --noEmit`
Expected: no errors.

Do not run `npx tsx scripts/content-engine/generate.ts` to "test" this. `main()` always targets *today's* date (`content/output/2026-07-23`), which was already generated, hand-edited, rendered to PNGs, and emailed earlier today — re-running it would overwrite `draft.json`/`review.md` with a fresh, different, un-rendered draft that no longer matches the already-rendered images, and would push extra entries into `content/state/history.json`'s per-pillar hook history for posts that were never actually used. `getCuratedFeed()` itself is already covered by a real-API test in Task 1; this step is a thin 6-line addition that mirrors the existing stats/copy try/catch immediately above it in the same function, so a typecheck plus a read-through of the diff is the appropriate level of verification. The next real morning run (tomorrow's cron, or the next manual `generate.ts` run on a fresh date) will exercise the integration for real.

- [ ] **Step 4: Commit**

```bash
git add scripts/content-engine/generate.ts
git commit -m "Wire curated feed into the daily draft email"
```

---

## Self-Review

**Spec coverage:** sourcing approach (Task 1, web_search tool) ✓; exact prompt scope/recency/tone (Task 1 system prompt) ✓; output format (Task 1) ✓; integration point + soft-fail (Task 2) ✓; "no changes to render.ts/sendEmail.ts/draft.json/content_drafts/plists" (nothing in either task touches them) ✓.

**Placeholder scan:** none found — both tasks have complete code, not descriptions.

**Type consistency:** `getCuratedFeed(): Promise<string>` declared in Task 1, imported and called identically in Task 2. No mismatches.
