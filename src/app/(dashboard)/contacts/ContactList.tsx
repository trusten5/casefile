"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  companyName: string | null;
  nextFollowUp: string | null;
};

type SortMode = "name" | "followUp";

export function ContactList({ contacts }: { contacts: Contact[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("name");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            (c.companyName ?? "").toLowerCase().includes(query)
        )
      : contacts;

    if (sort === "name") return [...base].sort((a, b) => a.name.localeCompare(b.name));
    // Soonest follow-up first, contacts with none pushed to the bottom.
    return [...base].sort((a, b) => {
      if (!a.nextFollowUp && !b.nextFollowUp) return a.name.localeCompare(b.name);
      if (!a.nextFollowUp) return 1;
      if (!b.nextFollowUp) return -1;
      return a.nextFollowUp < b.nextFollowUp ? -1 : a.nextFollowUp > b.nextFollowUp ? 1 : 0;
    });
  }, [contacts, search, sort]);

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts or companies…"
          className="w-full max-w-sm rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="name">Name</option>
            <option value="followUp">Soonest follow-up</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">
          {contacts.length === 0
            ? "No contacts yet — add the first one above."
            : `No contacts match "${search}".`}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/contacts/${c.id}`}
              className="flex items-center gap-3 rounded border border-paper-line bg-tab/20 p-4 hover:border-ink-soft"
            >
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-ink">{c.name}</p>
                  {c.nextFollowUp && (
                    <span className="shrink-0 rounded border border-status-oa px-2 py-0.5 font-mono text-[11px] font-medium text-status-oa">
                      Follow up {c.nextFollowUp}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-ink-soft">
                  {[c.role, c.companyName].filter(Boolean).join(" — ") || "No company on file"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
