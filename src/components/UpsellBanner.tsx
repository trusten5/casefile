"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";

const SESSION_COUNT_KEY = "casefile_upsell_save_count";

// Shown to free-tier users right after saving a posting/company — a nudge
// toward Plus, not a permanent nag. Only appears on the 3rd save of a
// browser session (sessionStorage — resets when the tab closes), not every
// single save; shared across both the /feed and company-save call sites
// since they both mount this same component per save.
export function UpsellBanner({ companyName }: { companyName: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    // sessionStorage doesn't exist during SSR, so this has to run
    // post-mount rather than during render — server always renders nothing
    // here (avoiding a hydration mismatch), then the client decides once
    // mounted. Not "state derived from props," so the usual
    // effects-are-for-external-systems lint concern doesn't apply here.
    const count = Number(sessionStorage.getItem(SESSION_COUNT_KEY) ?? "0") + 1;
    sessionStorage.setItem(SESSION_COUNT_KEY, String(count));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEligible(count === 3);
  }, []);

  if (!eligible || dismissed) return null;

  return (
    <div className="mb-4 flex max-w-md items-center justify-between gap-3 rounded border border-paper-line bg-tab/10 px-3 py-2 text-xs text-ink-soft">
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
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
