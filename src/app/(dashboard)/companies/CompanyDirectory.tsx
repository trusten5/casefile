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

export function CompanyDirectory({ companies, freeTier }: { companies: Company[]; freeTier: boolean }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("name");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query ? companies.filter((c) => c.name.toLowerCase().includes(query)) : companies;

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
  }, [companies, search, sort]);

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies…"
          className="w-full max-w-sm rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
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
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">No companies match &ldquo;{search}&rdquo;.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CompanyCard key={c.id} company={c} freeTier={freeTier} showFirstSeen={sort === "firstSeen"} />
          ))}
        </div>
      )}
    </div>
  );
}
