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
            ? "rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-50"
            : "rounded-md border border-paper-line px-3 py-1.5 text-sm text-ink disabled:opacity-50"
        }
      >
        {saved ? "Saved ✓" : "Save"}
      </button>
      {showUpsell && <UpsellBanner companyName={companyName} />}
    </div>
  );
}
