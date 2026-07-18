"use client";

import { useState } from "react";

export function CompanyLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [errored, setErrored] = useState(false);

  if (!logoUrl || errored) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tab font-display text-sm font-semibold text-ink-soft">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external, unsized logo host; next/image needs a configured domain per-host
    <img
      src={logoUrl}
      alt={`${name} logo`}
      width={36}
      height={36}
      onError={() => setErrored(true)}
      className="h-9 w-9 shrink-0 rounded-full border border-paper-line bg-paper object-contain p-1"
    />
  );
}
