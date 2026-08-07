"use client";

import { useState, useTransition } from "react";
import { UpsellBanner } from "@/components/UpsellBanner";

export function SaveCompanyButton({
  initialSaved,
  onSave,
  onUnsave,
  companyName,
  freeTier,
}: {
  initialSaved: boolean;
  onSave: () => Promise<void>;
  onUnsave: () => Promise<void>;
  companyName: string;
  freeTier: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();
  const [showUpsell, setShowUpsell] = useState(false);

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
      (next ? onSave() : onUnsave())
        .then(() => {
          if (next && freeTier) setShowUpsell(true);
        })
        .catch(() => setSaved(!next));
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={
          saved
            ? "rounded bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
            : "rounded border border-paper-line px-4 py-2 text-sm text-ink disabled:opacity-50"
        }
      >
        {saved ? "Saved ✓" : "Save company"}
      </button>
      {showUpsell && <UpsellBanner companyName={companyName} />}
    </div>
  );
}
