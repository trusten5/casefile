"use client";

import { useState } from "react";
import { postingFiltersToQueryString, type PostingFilters as Filters } from "@/lib/postingFilters";
import { useUrlFilters } from "@/lib/useUrlFilters";

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
  savedCompanies = [],
  basePath = "/feed",
}: {
  initialCompany: string;
  initialRoleType: string;
  initialLocation: string;
  initialKeyword: string;
  initialLevel: string;
  presets: FeedPreset[];
  savedCompanies?: string[];
  basePath?: string;
}) {
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const { filters, applyImmediately, applyDebounced } = useUrlFilters<Filters>(
    {
      company: initialCompany,
      roleType: initialRoleType,
      location: initialLocation,
      keyword: initialKeyword,
      level: initialLevel,
    },
    (f) => buildFeedUrl(basePath, f),
    TEXT_DEBOUNCE_MS
  );

  const matchingSavedCompanies = savedCompanies.filter((name) =>
    name.toLowerCase().includes(filters.company.trim().toLowerCase())
  );

  function selectSavedCompany(name: string) {
    setCompanyDropdownOpen(false);
    applyImmediately({ company: name });
  }

  function clearFilters() {
    applyImmediately({ company: "", roleType: "", location: "", keyword: "", level: "" });
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
      <label className="relative flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-ink-soft">
        Company
        <input
          value={filters.company}
          onChange={(e) => applyDebounced({ company: e.target.value })}
          onFocus={() => setCompanyDropdownOpen(true)}
          onBlur={() => setTimeout(() => setCompanyDropdownOpen(false), 150)}
          placeholder="Search companies…"
          autoComplete="off"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
        {companyDropdownOpen && matchingSavedCompanies.length > 0 && (
          <ul className="absolute left-0 top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-paper-line bg-paper py-1 shadow-sm">
            {matchingSavedCompanies.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSavedCompany(name)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-tab/20"
                >
                  ★ {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>
      <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-ink-soft">
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
      <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-ink-soft">
        Location contains
        <input
          value={filters.location}
          onChange={(e) => applyDebounced({ location: e.target.value })}
          placeholder="e.g. Remote, New York"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-ink-soft">
        Keyword (role, team, employment type)
        <input
          value={filters.keyword}
          onChange={(e) => applyDebounced({ keyword: e.target.value })}
          placeholder="e.g. Engineer, Design, Contract"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-ink-soft">
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
