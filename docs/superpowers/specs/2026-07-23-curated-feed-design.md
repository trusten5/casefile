# Curated feed in the draft email — design

## Scope

Add a "today's finds" section to the stage-1 draft email (`sendDraftEmail.ts`,
sent via `generate.ts`'s daily batch) surfacing real headlines/tweets pulled
from the web — source material for a possible manual meme/joke-style post,
never an auto-generated post itself. The account owner picks whether/how to
turn one into a post by hand; nothing here writes to `draft.json`, Supabase,
or gets rendered/posted automatically.

Explicitly out of scope for this round (decided during brainstorming):
- No AI-authored meme/joke pillar. Reads as unnatural, and meme formats lean
  too hard on a specific matching photo for the AI to pick well.
- No storage/dedup history for these items (unlike `history.ts`'s per-pillar
  hook tracking). They're sourced fresh from the last 24-48h every run, so
  same-day-repeat isn't a real risk the way stale hooks were.
- No structured schema / no forced tool-use for the response — it's 5 lines
  of text appended straight into `review.md`, never parsed back
  programmatically.
- "Add more pillars if you find gaps" (mentioned in passing) is a separate,
  later conversation — not part of this design.

## Sourcing approach

Claude's server-side web search tool (`web_search_20250305`), called from a
new `curatedFeed.ts` the same way `generateCopy.ts` already calls the
Messages API — same `ANTHROPIC_API_KEY`, no new credential or dependency.

Rejected alternatives:
- **Free headline APIs (HN/Reddit JSON, no key needed):** cheaper, but skews
  tech-nerd and needs hand-rolled keyword filtering to hit "job
  search/career/college/finance/corporate" — worse curation quality than an
  LLM judging "is this actually interesting," and it's tweet-blind.
- **Browser automation against X/Twitter directly:** most authentic
  tweet-specific sourcing, but needs a logged-in session and a headless
  browser dependency inside a cron script that currently has zero browser
  dependencies — fragile (breaks on site changes) and heavier than this
  feature warrants.

## `scripts/content-engine/curatedFeed.ts`

New file, one exported function:

```ts
export async function getCuratedFeed(): Promise<string>
```

- Same `MODEL` fallback pattern as `generateCopy.ts`
  (`process.env.CONTENT_ENGINE_MODEL || "claude-sonnet-5"`).
- Calls the Messages API with
  `tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }]`
  — no `tool_choice` forcing, no custom schema.
- System/user prompt asks for exactly 5 items, each on its own line,
  formatted `<headline or tweet text> — <URL>`, nothing else (no ranking
  explanation, no commentary):
  - **Scope:** job search, careers, college, tech, finance, interviews,
    corporate/business/VC trends. Examples to anchor the model: "[company]
    revolutionizes interview process," a crazy VC/business trend, a new
    hiring-by-degree report, colleges ranked by starting salary.
  - **Recency:** last 24-48 hours only.
  - **Tone:** non-political siding, but legislation/policy announcements
    that hit these topic areas are fair game. Controversy is fine as long
    as it's on-topic — don't chase controversy for its own sake off-topic.
- Returns the final text content block from the response (the block after
  any interleaved `server_tool_use`/`web_search_tool_result` blocks).

## Integration into `generate.ts`

After the existing pillar loop (tactical-advice, networking-tactics, cta),
one more step:

```ts
try {
  const feed = await getCuratedFeed();
  reviewLines.push("## Today's finds (not auto-posted — yours to look into)", feed, "");
} catch (err) {
  console.error("Curated feed fetch failed, skipping:", err);
  reviewLines.push("## Today's finds — SKIPPED (fetch failed)\n");
}
```

Matches the existing soft-fail convention already used for stats/copy
failures in the same loop — a failure here never blocks the rest of the
batch or the draft email from going out.

No changes to `render.ts`, `sendEmail.ts`, `draft.json`'s shape, the
`content_drafts` Supabase mirror, or either plist. `sendDraftEmail.ts`
already emails `review.md` verbatim, so this is the only wiring needed for
the section to show up in the inbox.

## Known v1 limitations

- If the model doesn't follow the "5 lines, headline — URL" format exactly,
  the email just shows whatever text came back — no validation/retry. Low
  stakes since a human reads it before acting on anything; tighten the
  prompt if this drifts in practice rather than adding parsing/retry logic
  upfront.
- `max_uses: 5` bounds search-tool calls per run but not overall cost/latency
  precisely — acceptable for a once-a-day batch job; revisit if it becomes
  slow or expensive.
