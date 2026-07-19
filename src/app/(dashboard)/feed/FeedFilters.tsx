"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { postingFiltersToQueryString, type PostingFilters as Filters } from "@/lib/postingFilters";

const ROLE_TYPES = [
  { value: "", label: "All roles" },
  { value: "internship", label: "Internship" },
  { value: "new_grad", label: "New grad" },
  { value: "full_time", label: "Full-time" },
];

const LEVELS = [
  { value: "", label: "All" },
  { value: "undergrad", label: "Undergrad" },
  { value: "phd", label: "PhD" },
];

const TEXT_DEBOUNCE_MS = 400;

function buildFeedUrl(basePath: string, filters: Filters) {
  const query = postingFiltersToQueryString(filters);
  return query ? `${basePath}?${query}` : basePath;
}

export type FeedPreset = { id: string } & Filters & { name: string };

export function FeedFilters({
  initialCompany,
  initialRoleType,
  initialLocation,
  initialKeyword,
  initialLevel,
  presets,
  basePath = "/feed",
}: {
  initialCompany: string;
  initialRoleType: string;
  initialLocation: string;
  initialKeyword: string;
  initialLevel: string;
  presets: FeedPreset[];
  basePath?: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({
    company: initialCompany,
    roleType: initialRoleType,
    location: initialLocation,
    keyword: initialKeyword,
    level: initialLevel,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Selects apply immediately; free-text fields debounce so we're not
  // re-fetching on every keystroke.
  function applyImmediately(patch: Partial<Filters>) {
    clearTimeout(debounceRef.current);
    const next = { ...filters, ...patch };
    setFilters(next);
    router.replace(buildFeedUrl(basePath, next));
  }

  function applyDebounced(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => router.replace(buildFeedUrl(basePath, next)),
      TEXT_DEBOUNCE_MS
    );
  }

  function clearFilters() {
    clearTimeout(debounceRef.current);
    const next = { company: "", roleType: "", location: "", keyword: "", level: "" };
    setFilters(next);
    router.replace(basePath);
  }

  function applyPreset(id: string) {
    const preset = presets.find((p) => p.id === id);
    if (preset) applyImmediately(preset);
  }

  return (
    <div className="mt-6 flex flex-wrap items-end gap-4">
      {presets.length > 0 && (
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Saved filter
          <select
            value=""
            onChange={(e) => applyPreset(e.target.value)}
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">Load a saved filter…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Company
        <input
          value={filters.company}
          onChange={(e) => applyDebounced({ company: e.target.value })}
          placeholder="Search companies…"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Role type
        <select
          value={filters.roleType}
          onChange={(e) => applyImmediately({ roleType: e.target.value })}
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        >
          {ROLE_TYPES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Location contains
        <input
          value={filters.location}
          onChange={(e) => applyDebounced({ location: e.target.value })}
          placeholder="e.g. Remote, New York"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Keyword (role, team, employment type)
        <input
          value={filters.keyword}
          onChange={(e) => applyDebounced({ keyword: e.target.value })}
          placeholder="e.g. Engineer, Design, Contract"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Level
        <select
          value={filters.level}
          onChange={(e) => applyImmediately({ level: e.target.value })}
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={clearFilters}
        className="text-sm font-medium text-ink-soft hover:text-ink"
      >
        Clear filters
      </button>
    </div>
  );
}
