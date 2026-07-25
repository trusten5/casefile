"use client";

import { useRef, useState } from "react";
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

// savedCompaniesOnly rides alongside the URL-serializable filters as its own
// param instead of joining PostingFilters — it's a /feed-only concept (the
// landing-page teaser and digest cron share that type and don't need it).
function buildFeedUrl(basePath: string, filters: Filters, savedCompaniesOnly: boolean) {
  const params = new URLSearchParams(postingFiltersToQueryString(filters));
  if (savedCompaniesOnly) params.set("savedCompanies", "1");
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export type FeedPreset = { id: string } & Filters & { name: string };

export function FeedFilters({
  initialCompany,
  initialRoleType,
  initialLocation,
  initialKeyword,
  initialLevel,
  initialSavedCompaniesOnly = false,
  presets,
  savedCompanies = [],
  basePath = "/feed",
}: {
  initialCompany: string;
  initialRoleType: string;
  initialLocation: string;
  initialKeyword: string;
  initialLevel: string;
  initialSavedCompaniesOnly?: boolean;
  presets: FeedPreset[];
  savedCompanies?: string[];
  basePath?: string;
}) {
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [savedCompaniesOnly, setSavedCompaniesOnly] = useState(initialSavedCompaniesOnly);
  // useUrlFilters's buildUrl closure is captured fresh each render, but a
  // handler that flips this state and calls applyImmediately in the same
  // synchronous pass would still see the *previous* render's value through
  // the closure — a ref sidesteps that instead of threading a second
  // argument through the shared hook (ApplicationFilters uses it too).
  const savedCompaniesOnlyRef = useRef(savedCompaniesOnly);

  const { filters, applyImmediately, applyDebounced } = useUrlFilters<Filters>(
    {
      company: initialCompany,
      roleType: initialRoleType,
      location: initialLocation,
      keyword: initialKeyword,
      level: initialLevel,
    },
    (f) => buildFeedUrl(basePath, f, savedCompaniesOnlyRef.current),
    TEXT_DEBOUNCE_MS
  );

  const matchingSavedCompanies = savedCompanies.filter((name) =>
    name.toLowerCase().includes(filters.company.trim().toLowerCase())
  );

  function updateSavedCompaniesOnly(next: boolean) {
    savedCompaniesOnlyRef.current = next;
    setSavedCompaniesOnly(next);
  }

  // Any other filter change is a switch away from saved-companies-only mode.
  function applyImmediatelyReset(patch: Partial<Filters>) {
    updateSavedCompaniesOnly(false);
    applyImmediately(patch);
  }

  function selectSavedCompany(name: string) {
    setCompanyDropdownOpen(false);
    applyImmediatelyReset({ company: name });
  }

  function selectAllSavedCompanies() {
    setCompanyDropdownOpen(false);
    updateSavedCompaniesOnly(true);
    applyImmediately({ company: "" });
  }

  function clearSavedCompaniesOnly() {
    updateSavedCompaniesOnly(false);
    applyImmediately({});
  }

  function onCompanyInputChange(value: string) {
    updateSavedCompaniesOnly(false);
    applyDebounced({ company: value });
  }

  function clearFilters() {
    applyImmediatelyReset({ company: "", roleType: "", location: "", keyword: "", level: "" });
  }

  function applyPreset(id: string) {
    const preset = presets.find((p) => p.id === id);
    if (preset) applyImmediatelyReset(preset);
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
        <div className="flex items-center gap-2">
          <input
            value={filters.company}
            onChange={(e) => onCompanyInputChange(e.target.value)}
            onFocus={() => setCompanyDropdownOpen(true)}
            onBlur={() => setTimeout(() => setCompanyDropdownOpen(false), 150)}
            placeholder={savedCompaniesOnly ? "All saved companies" : "Search companies…"}
            autoComplete="off"
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
          {savedCompaniesOnly && (
            <button
              type="button"
              onClick={clearSavedCompaniesOnly}
              className="shrink-0 text-ink-soft hover:text-ink"
              title="Clear"
            >
              ✕
            </button>
          )}
        </div>
        {companyDropdownOpen && savedCompanies.length > 0 && (
          <ul className="absolute left-0 top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-paper-line bg-paper py-1 shadow-sm">
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={selectAllSavedCompanies}
                className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-tab/20"
              >
                ★ All saved companies
              </button>
            </li>
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
          onChange={(e) => applyImmediatelyReset({ roleType: e.target.value })}
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
          onChange={(e) => {
            updateSavedCompaniesOnly(false);
            applyDebounced({ location: e.target.value });
          }}
          placeholder="e.g. Remote, New York"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-ink-soft">
        Keyword (role, team, employment type)
        <input
          value={filters.keyword}
          onChange={(e) => {
            updateSavedCompaniesOnly(false);
            applyDebounced({ keyword: e.target.value });
          }}
          placeholder="e.g. Engineer, Design, Contract"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-ink-soft">
        Level
        <select
          value={filters.level}
          onChange={(e) => applyImmediatelyReset({ level: e.target.value })}
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
