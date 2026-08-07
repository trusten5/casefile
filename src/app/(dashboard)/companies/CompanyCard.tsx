"use client";

import Link from "next/link";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ArrowIcon, PersonIcon } from "@/components/icons";
import { formatPostedDate } from "@/lib/dates";
import { saveCompany, unsaveCompany } from "./actions";
import { SaveCompanyButton } from "./SaveCompanyButton";

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

// Shared by the "Saved companies" section and the "All companies" directory
// so a card looks and behaves identically wherever it shows up.
export function CompanyCard({ company: c, showFirstSeen = false }: { company: Company; showFirstSeen?: boolean }) {
  const save = saveCompany.bind(null, c.id, "/companies");
  const unsave = unsaveCompany.bind(null, c.id, "/companies");

  return (
    <div className="flex items-center gap-3 rounded border border-paper-line bg-tab/20 p-4 hover:border-ink-soft">
      <Link href={`/companies/${c.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
        <CompanyLogo name={c.name} logoUrl={c.logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-ink">{c.name}</p>
            {c.contactCount > 0 && (
              <span
                title={`You know ${c.contactCount} ${c.contactCount === 1 ? "person" : "people"} here`}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-status-offer px-1.5 py-0.5 font-mono text-[11px] font-medium text-status-offer"
              >
                <PersonIcon className="h-2.5 w-2.5" /> {c.contactCount}
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
          {showFirstSeen && (
            <p className="font-mono text-xs text-ink-soft">
              {c.firstSeenAt ? `First seen ${formatPostedDate(c.firstSeenAt)}` : "Not seen yet"}
            </p>
          )}
        </div>
        <ArrowIcon className="shrink-0 text-ink-soft" />
      </Link>
      <SaveCompanyButton initialSaved={c.isSaved} onSave={save} onUnsave={unsave} />
    </div>
  );
}
