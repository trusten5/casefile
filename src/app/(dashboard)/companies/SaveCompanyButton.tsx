"use client";

import { useState, useTransition } from "react";

export function SaveCompanyButton({
  initialSaved,
  onSave,
  onUnsave,
}: {
  initialSaved: boolean;
  onSave: () => Promise<void>;
  onUnsave: () => Promise<void>;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  // The same company can render in two places at once (e.g. "Saved
  // companies" and "All companies"). Toggling one revalidates the page and
  // sends this instance a fresh initialSaved — resync during render (React's
  // documented pattern for derived state) instead of a setState-in-effect,
  // which would render once stale before catching up.
  const [prevInitialSaved, setPrevInitialSaved] = useState(initialSaved);
  if (initialSaved !== prevInitialSaved) {
    setPrevInitialSaved(initialSaved);
    setSaved(initialSaved);
  }

  function toggle() {
    const next = !saved;
    setSaved(next);
    startTransition(() => {
      (next ? onSave() : onUnsave()).catch(() => setSaved(!next));
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={
        saved
          ? "rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-50"
          : "rounded-md border border-paper-line px-3 py-1.5 text-sm text-ink disabled:opacity-50"
      }
    >
      {saved ? "Saved ✓" : "Save"}
    </button>
  );
}
