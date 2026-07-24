"use client";

import { useRef, useState, useTransition } from "react";
import { deleteSavedFilter } from "./actions";

// How long "Removed. Undo" stays up before the delete actually commits.
const UNDO_MS = 5000;

export function DeleteFilterButton({ filterId }: { filterId: string }) {
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
    return (
      <span className="text-xs text-ink-soft">
        Removed.{" "}
        <button type="button" onClick={onUndoRemove} className="font-medium text-ink underline">
          Undo
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onRemove}
      className="text-xs text-ink-soft hover:text-status-rejected"
    >
      Remove
    </button>
  );
}
