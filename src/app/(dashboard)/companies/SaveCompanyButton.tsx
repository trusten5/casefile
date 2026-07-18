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
          ? "rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
          : "rounded-md border border-paper-line px-4 py-2 text-sm text-ink disabled:opacity-50"
      }
    >
      {saved ? "Saved ✓" : "Save company"}
    </button>
  );
}
