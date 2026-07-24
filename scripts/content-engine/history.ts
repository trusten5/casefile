// Tracks recently-used hooks per pillar so generateCopy.ts can tell the
// model what not to repeat, plus the slot-3 rotation index (see
// nextSlot3Pillar) — the content engine otherwise has zero memory across
// runs. Gitignored (regenerable state, not a real asset), same as
// content/assets and content/output.
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Pillar } from "./pillars";

const HISTORY_PATH = join(__dirname, "..", "..", "content", "state", "history.json");
const MAX_PER_PILLAR = 20;

interface HistoryFile {
  hooks: Record<string, string[]>;
  slot3Index: number;
}

function load(): HistoryFile {
  try {
    const parsed = JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
    // Old format was just the flat pillarKey -> string[] map (no `hooks`/
    // `slot3Index` wrapper) — migrate in place instead of discarding real
    // accumulated anti-repeat history on the first run after this change.
    if (!("hooks" in parsed) && !("slot3Index" in parsed)) {
      return { hooks: parsed, slot3Index: 0 };
    }
    return { hooks: parsed.hooks ?? {}, slot3Index: parsed.slot3Index ?? 0 };
  } catch {
    return { hooks: {}, slot3Index: 0 };
  }
}

function save(state: HistoryFile) {
  mkdirSync(join(__dirname, "..", "..", "content", "state"), { recursive: true });
  writeFileSync(HISTORY_PATH, JSON.stringify(state, null, 2));
}

export function recentHooks(pillarKey: string): string[] {
  return load().hooks[pillarKey] ?? [];
}

export function recordHook(pillarKey: string, hook: string) {
  const state = load();
  const list = state.hooks[pillarKey] ?? [];
  list.push(hook);
  state.hooks[pillarKey] = list.slice(-MAX_PER_PILLAR);
  save(state);
}

// Rotates through slot3Pool one pillar per batch, persisting the index
// across runs so the same pillar (e.g. the CTA) doesn't land every day and
// every pillar in the pool gets an even turn.
export function nextSlot3Pillar(pool: Pillar[]): Pillar {
  const state = load();
  const pillar = pool[state.slot3Index % pool.length];
  state.slot3Index = (state.slot3Index + 1) % pool.length;
  save(state);
  return pillar;
}
