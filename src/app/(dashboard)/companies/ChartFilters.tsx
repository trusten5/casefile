"use client";

import { useRouter } from "next/navigation";

const WINDOWS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const TYPES = [
  { value: "", label: "All types" },
  { value: "internship", label: "Internship" },
  { value: "full_time", label: "Full-time" },
];

function buildUrl(window: string, type: string) {
  const params = new URLSearchParams();
  if (window !== "24h") params.set("window", window);
  if (type) params.set("type", type);
  const query = params.toString();
  return query ? `/companies?${query}` : "/companies";
}

export function ChartFilters({
  initialWindow,
  initialType,
}: {
  initialWindow: string;
  initialType: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Time
        <select
          value={initialWindow}
          onChange={(e) => router.replace(buildUrl(e.target.value, initialType))}
          className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        >
          {WINDOWS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Job type
        <select
          value={initialType}
          onChange={(e) => router.replace(buildUrl(initialWindow, e.target.value))}
          className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
