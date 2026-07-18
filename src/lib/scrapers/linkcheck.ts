import { getSupabase } from "@/lib/supabase";
import { pool } from "@/lib/pool";

const STALE_AFTER_DAYS = 21;
// Small and gentle on purpose — an earlier attempt at concurrency 10 /
// batch 300 got progressively rate-limited by the career-site hosts within
// a few hundred requests (alive rate collapsed from ~99% to ~5%). This is
// meant to clear the backlog gradually over many real sync cycles, not in
// one aggressive pass.
const BATCH_SIZE = 40;
const CONCURRENCY = 2;
const REQUEST_SPACING_MS = 300;

// ponytail: phrase list, not exhaustive — covers common ATS/career-site
// wording for a closed posting. Misses site-specific soft-404s that phrase
// it differently; the user-report flag is the backstop for those.
const DEAD_PATTERN =
  /no longer (accepting|available)|position (has been filled|closed)|job (posting )?(has expired|is no longer available)|this (job|position|posting) (is|has been) (closed|filled|removed)|posting not found|page not found|job not found/i;

type LinkStatus = "alive" | "dead" | "unknown";

// Some career sites block requests with no User-Agent outright (anti-bot
// rule, not a signal the posting is gone) — a realistic one cuts down
// false "inconclusive" results.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkUrl(url: string): Promise<LinkStatus> {
  await sleep(REQUEST_SPACING_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": USER_AGENT },
    });
    if (res.status === 404 || res.status === 410) return "dead";
    if (!res.ok) return "unknown"; // 403/500/etc. — inconclusive, don't guess off a blocked request
    const text = await res.text();
    return DEAD_PATTERN.test(text) ? "dead" : "alive";
  } catch {
    return "unknown"; // network error/timeout — retry next run rather than assume dead
  }
}

// Only ever looks at postings that have never been checked — once a posting
// is checked (alive or dead) it's not re-checked, bounding this to roughly
// "postings that just crossed 21 days old since last run" per invocation
// instead of re-scanning the whole table every sync.
export async function checkStaleLinks() {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from("postings")
    .select("id, url")
    .eq("is_active", true)
    .is("link_checked_at", null)
    .lt("posted_at", cutoff)
    .limit(BATCH_SIZE);
  if (error) throw error;
  if (!candidates || candidates.length === 0) {
    return { checked: 0, dead: 0, alive: 0, inconclusive: 0 };
  }

  const results = await pool(candidates, CONCURRENCY, async (p) => ({
    ...p,
    status: await checkUrl(p.url),
  }));

  const now = new Date().toISOString();
  const deadIds = results.filter((r) => r.status === "dead").map((r) => r.id);
  const aliveIds = results.filter((r) => r.status === "alive").map((r) => r.id);

  if (deadIds.length > 0) {
    const { error: deadError } = await supabase
      .from("postings")
      .update({ is_active: false, link_checked_at: now })
      .in("id", deadIds);
    if (deadError) throw deadError;
  }
  if (aliveIds.length > 0) {
    const { error: aliveError } = await supabase
      .from("postings")
      .update({ link_checked_at: now })
      .in("id", aliveIds);
    if (aliveError) throw aliveError;
  }

  return {
    checked: results.length,
    dead: deadIds.length,
    alive: aliveIds.length,
    inconclusive: results.length - deadIds.length - aliveIds.length,
  };
}
