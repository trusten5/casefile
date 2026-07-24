"use client";

import { useRef, useState, useTransition } from "react";
import { UndoToast } from "@/components/UndoToast";
import { deleteSavedFilter, setDefaultFilter } from "./actions";
import type { FilterScope } from "@/lib/preferences";

// How long the "Removed. Undo" toast stays up before the delete actually commits.
const UNDO_MS = 5000;

export function SavedFilterRow({
  filterId,
  scope,
  name,
  summary,
  isDefault,
}: {
  filterId: string;
  scope: FilterScope;
  name: string;
  summary: string;
  isDefault: boolean;
}) {
  const [pendingRemove, setPendingRemove] = useState(false);
  const [, startTransition] = useTransition();
  const removeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function onRemove() {
    setPendingRemove(true);
    removeTimer.current = setTimeout(() => {
      startTransition(() => {
        deleteSavedFilter(filterId).catch(() => setPendingRemove(false));
      });
    }, UNDO_MS);
  }

  function onUndoRemove() {
    clearTimeout(removeTimer.current);
    setPendingRemove(false);
  }

  if (pendingRemove) {
    return <UndoToast message="Filter removed." onUndo={onUndoRemove} />;
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">
          {name}
          {isDefault && (
            <span className="ml-2 rounded-full bg-status-offer/15 px-2 py-0.5 font-mono text-[11px] font-medium text-status-offer">
              Default
            </span>
          )}
        </p>
        <p className="truncate text-xs text-ink-soft">{summary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <form action={setDefaultFilter.bind(null, filterId, scope, !isDefault)}>
          <button type="submit" className="rounded-md border border-paper-line px-3 py-1.5 text-xs text-ink">
            {isDefault ? "Unset default" : "Set as default"}
          </button>
        </form>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-ink-soft hover:text-status-rejected"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
