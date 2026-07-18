"use client";

import { useMemo, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { CompanyLogo } from "@/components/CompanyLogo";
import { formatPostedDate } from "@/lib/dates";
import { saveCompany, unsaveCompany } from "./actions";

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

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-ink-soft"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// A card is one big <Link> to the company page, so this toggle can't be a
// nested <button> inside it — it stops propagation and lives as a sibling.
function SaveToggle({ companyId, initialSaved }: { companyId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    startTransition(() => {
      (next ? saveCompany(companyId, "/companies") : unsaveCompany(companyId, "/companies")).catch(
        () => setSaved(!next)
      );
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title={saved ? "Unsave company" : "Save company"}
      aria-label={saved ? "Unsave company" : "Save company"}
      className="shrink-0 rounded-full p-1.5 text-lg leading-none text-ink-soft hover:text-ink disabled:opacity-50"
    >
      {saved ? "★" : "☆"}
    </button>
  );
}

export function CompanyDirectory({ companies }: { companies: Company[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [savedOnly, setSavedOnly] = useState(false);

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
        <label className="flex items-center gap-2 pb-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={savedOnly}
            onChange={(e) => setSavedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-paper-line"
          />
          My saved companies
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">
          {savedOnly ? "You haven't saved any companies yet." : `No companies match “${search}”.`}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-paper-line bg-tab/20 p-4 hover:border-ink-soft"
            >
              <Link href={`/companies/${c.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                <CompanyLogo name={c.name} logoUrl={c.logoUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-ink">{c.name}</p>
                    {c.contactCount > 0 && (
                      <span
                        title={`You know ${c.contactCount} ${c.contactCount === 1 ? "person" : "people"} here`}
                        className="shrink-0 rounded-full bg-status-offer/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-status-offer"
                      >
                        👤 {c.contactCount}
                      </span>
                    )}
                  </div>
                  {c.mostRecentTitle ? (
                    <p className="truncate text-xs text-ink-soft">{c.mostRecentTitle}</p>
                  ) : (
                    <p className="text-xs text-ink-soft">Nothing active right now</p>
                  )}
                  {c.activeCount > 1 && (
                    <p className="font-mono text-xs text-ink-soft">
                      View {c.activeCount - 1} other posting{c.activeCount - 1 === 1 ? "" : "s"}
                    </p>
                  )}
                  {sort === "firstSeen" && (
                    <p className="font-mono text-xs text-ink-soft">
                      {c.firstSeenAt ? `First seen ${formatPostedDate(c.firstSeenAt)}` : "Not seen yet"}
                    </p>
                  )}
                </div>
                <ArrowIcon />
              </Link>
              <SaveToggle companyId={c.id} initialSaved={c.isSaved} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
