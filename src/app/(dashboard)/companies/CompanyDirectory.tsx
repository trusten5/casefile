"use client";

import { useMemo, useState } from "react";
import { CompanyCard } from "./CompanyCard";

type Company = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  activeCount: number;
  firstSeenAt: string | null;
  mostRecentTitle: string | null;
  isSaved: boolean;
  contactCount: number;
};

type SortMode = "name" | "firstSeen";

export function CompanyDirectory({ companies }: { companies: Company[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [savedOnly, setSavedOnly] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let base = query ? companies.filter((c) => c.name.toLowerCase().includes(query)) : companies;
    if (savedOnly) base = base.filter((c) => c.isSaved);

    if (sort === "name") {
      return [...base].sort((a, b) => a.name.localeCompare(b.name));
    }
    // First seen: most recently-sighted companies first, "not seen yet" pushed
    // to the bottom rather than dropped — this is First Sightings folded in.
    return [...base].sort((a, b) => {
      if (!a.firstSeenAt && !b.firstSeenAt) return a.name.localeCompare(b.name);
      if (!a.firstSeenAt) return 1;
      if (!b.firstSeenAt) return -1;
      return b.firstSeenAt < a.firstSeenAt ? -1 : b.firstSeenAt > a.firstSeenAt ? 1 : 0;
    });
  }, [companies, search, sort, savedOnly]);

  function selectAllSaved() {
    setSavedOnly(true);
    setSearchDropdownOpen(false);
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="relative w-full max-w-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchDropdownOpen(true)}
            onBlur={() => setTimeout(() => setSearchDropdownOpen(false), 150)}
            placeholder={savedOnly ? "Search saved companies…" : "Search companies…"}
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
          {searchDropdownOpen && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border border-paper-line bg-paper py-1 shadow-sm">
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={selectAllSaved}
                  className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-tab/20"
                >
                  ★ All saved companies
                </button>
              </li>
            </ul>
          )}
        </div>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="name">Name</option>
            <option value="firstSeen">First seen (newest sighting first)</option>
          </select>
        </label>
        {savedOnly && (
          <button
            type="button"
            onClick={() => setSavedOnly(false)}
            className="pb-2 text-sm text-ink-soft hover:text-ink"
          >
            Saved only ✕
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">
          {savedOnly ? "You haven't saved any companies yet." : `No companies match “${search}”.`}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CompanyCard key={c.id} company={c} showFirstSeen={sort === "firstSeen"} />
          ))}
        </div>
      )}
    </div>
  );
}
