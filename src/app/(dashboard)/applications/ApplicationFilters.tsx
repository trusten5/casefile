"use client";

import { useUrlFilters } from "@/lib/useUrlFilters";

type Filters = { company: string; roleType: string; level: string };

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

function buildUrl(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.company) params.set("company", filters.company);
  if (filters.roleType) params.set("roleType", filters.roleType);
  if (filters.level) params.set("level", filters.level);
  const query = params.toString();
  return query ? `/applications?${query}` : "/applications";
}

export type ApplicationPreset = { id: string; name: string } & Filters;

export function ApplicationFilters({
  initialCompany,
  initialRoleType,
  initialLevel,
  presets,
}: {
  initialCompany: string;
  initialRoleType: string;
  initialLevel: string;
  presets: ApplicationPreset[];
}) {
  const { filters, applyImmediately, applyDebounced } = useUrlFilters<Filters>(
    { company: initialCompany, roleType: initialRoleType, level: initialLevel },
    buildUrl,
    TEXT_DEBOUNCE_MS
  );

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
    </div>
  );
}
