import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export const STATUSES = [
  { value: "applied", label: "Applied", color: "text-status-applied" },
  { value: "oa", label: "OA", color: "text-status-oa" },
  { value: "interview", label: "Interview", color: "text-status-interview" },
  { value: "offer", label: "Offer", color: "text-status-offer" },
  { value: "rejected", label: "Rejected", color: "text-status-rejected" },
  { value: "ghosted", label: "Ghosted", color: "text-status-ghosted" },
] as const;

// Shared by the applications page (full funnel view) and the dashboard
// (compact snapshot) so the two never drift on how a count is defined.
// Wrapped in React's cache() so a second invocation within the same
// request reuses the first's result instead of re-querying — this Next
// version can invoke a Server Component's render more than once per
// request, and without memoization a live re-query could race against the
// user's own concurrent action and return different rows, producing a
// hydration mismatch (a real one hit getApplicationFlow below).
export const getFunnelCounts = cache(async (supabase: SupabaseClient, userId: string) => {
  const counts: Record<string, number> = {};
  for (const s of STATUSES) counts[s.value] = 0;

  const { data, error } = await supabase.from("applications").select("status").eq("user_id", userId);
  if (error) throw error;

  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
});

export const PIPELINE = ["applied", "oa", "interview", "offer"] as const;
const PIPELINE_INDEX: Record<string, number> = { applied: 0, oa: 1, interview: 2, offer: 3 };

// If a status change jumps more than one pipeline stage ahead (e.g. Applied
// straight to Interview), returns the stage(s) in between so the caller can
// ask "did this go through OA first?" instead of silently recording the
// jump as one direct edge. Returns [] for backward moves or when either
// side is an exit status (rejected/ghosted) — going straight to Rejected
// from Applied is a normal outcome, not a skip.
export function getSkippedStages(oldStatus: string, newStatus: string): string[] {
  const oldIdx = PIPELINE_INDEX[oldStatus];
  const newIdx = PIPELINE_INDEX[newStatus];
  if (oldIdx === undefined || newIdx === undefined || newIdx <= oldIdx + 1) return [];
  return PIPELINE.slice(oldIdx + 1, newIdx);
}

// Pipeline stages rank by their order; rejected/ghosted both rank past the
// end of the pipeline (either can follow any stage). Used to tell forward
// progress apart from a backward correction.
export function getStageRank(status: string): number {
  const idx = PIPELINE_INDEX[status];
  return idx === undefined ? PIPELINE.length : idx;
}

export type ApplicationFlow = {
  entryCount: Record<string, number>; // apps whose first-ever history entry is this status
  exitCount: Record<string, number>; // apps currently resting here (last-ever history entry)
  edges: { from: string; to: string; count: number }[]; // real observed transitions, literal — no implied stages
};

// Reconstructs the real transition graph from status_history instead of
// either (a) just the current status, or (b) assuming a later stage implies
// every earlier one. An application that went applied -> oa -> interview ->
// rejected contributes edges applied->oa, oa->interview, interview->rejected
// — a skipped stage (e.g. applied straight to interview) shows up as its
// own direct edge instead of being silently backfilled. Pairs with
// getSkippedStages, which lets the UI offer to log a skipped stage for real
// (as an actual history row) at the moment a jump happens, so this graph
// stays accurate rather than accumulating skip-edges by default.
//
// Wrapped in cache() — see getFunnelCounts above. This one actually caused
// a hydration mismatch in practice: a status update between two renders of
// the same request changed status_history mid-flight, so the ribbons'
// labels differed between what the server sent and what the client
// recomputed.
export const getApplicationFlow = cache(
  async (supabase: SupabaseClient, userId: string): Promise<ApplicationFlow> => {
    const { data, error } = await supabase
      .from("status_history")
      .select("application_id, status, changed_at, applications!inner(user_id)")
      .eq("applications.user_id", userId)
      .order("changed_at", { ascending: true });
    if (error) throw error;

    const pathByApp = new Map<string, string[]>();
    for (const row of data ?? []) {
      const path = pathByApp.get(row.application_id) ?? [];
      // Dedupe consecutive repeats — a transition needs an actual status change.
      if (path[path.length - 1] !== row.status) path.push(row.status);
      pathByApp.set(row.application_id, path);
    }

    const entryCount: Record<string, number> = {};
    const exitCount: Record<string, number> = {};
    const edgeCounts = new Map<string, number>();
    for (const path of pathByApp.values()) {
      if (path.length === 0) continue;
      entryCount[path[0]] = (entryCount[path[0]] ?? 0) + 1;
      exitCount[path[path.length - 1]] = (exitCount[path[path.length - 1]] ?? 0) + 1;
      for (let i = 0; i < path.length - 1; i++) {
        const key = `${path[i]}->${path[i + 1]}`;
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      }
    }

    const edges = Array.from(edgeCounts.entries()).map(([key, count]) => {
      const [from, to] = key.split("->");
      return { from, to, count };
    });

    return { entryCount, exitCount, edges };
  }
);
