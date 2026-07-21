// Tracks recently-used hooks per pillar so generateCopy.ts can tell the
// model what not to repeat — the content engine otherwise has zero memory
// across runs. Gitignored (regenerable state, not a real asset), same as
// content/assets and content/output.
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const HISTORY_PATH = join(__dirname, "..", "..", "content", "state", "history.json");
const MAX_PER_PILLAR = 20;

type History = Record<string, string[]>;

function load(): History {
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function recentHooks(pillarKey: string): string[] {
  return load()[pillarKey] ?? [];
}

export function recordHook(pillarKey: string, hook: string) {
  const history = load();
  const list = history[pillarKey] ?? [];
  list.push(hook);
  history[pillarKey] = list.slice(-MAX_PER_PILLAR);
  mkdirSync(join(__dirname, "..", "..", "content", "state"), { recursive: true });
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}
