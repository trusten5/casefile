"use client";

import Link from "next/link";
import { useState } from "react";

// Shown to free-tier users right after saving a posting/company — a nudge
// toward Plus, not a permanent nag. Dismissible locally; it naturally stops
// appearing on the next page load anyway since it's driven by a one-time
// flash-style signal, not persisted state.
export function UpsellBanner({ companyName }: { companyName: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mb-4 flex max-w-md items-center justify-between gap-3 rounded-md border border-paper-line bg-tab/10 px-3 py-2 text-xs text-ink-soft">
      <span>
        Get emailed when {companyName} posts something new —{" "}
        <Link href="/profile" className="font-medium text-ink underline">
          Upgrade to Plus
        </Link>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-ink-soft hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
